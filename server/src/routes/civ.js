import { Router } from "express";
import { pool } from "../db.js";
import { getCivById, onboardCiv, civViewModel, buyCard, produce, harvest, HARVEST_TASKS, httpError, rowToCiv } from "../civ.js";
import { availableActions, runUnitAction } from "../actions.js";
import { scriptedEventForTurn } from "../events.js";
import { yearForTurn, epochForYear, formatYear } from "../turns.js";
import { loadContent } from "../content.js";

const router = Router();

function requireCivSession(req, res, next) {
  const civId = req.signedCookies?.civ_session;
  if (!civId) return next(httpError(401, "Session élève manquante — rejoins ta classe d'abord."));
  req.civId = Number(civId);
  next();
}

router.use(requireCivSession);

router.get("/me", async (req, res, next) => {
  try {
    const civ = await getCivById(req.civId);
    if (!civ) throw httpError(404, "Civilisation introuvable.");
    res.json(civViewModel(civ));
  } catch (err) {
    next(err);
  }
});

router.post("/me/onboard", async (req, res, next) => {
  try {
    const civ = await onboardCiv(req.civId, req.body || {});
    res.json(civViewModel(civ));
  } catch (err) {
    next(err);
  }
});

router.post("/me/tutorial-seen", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE civilizations SET tutorial_seen = true, updated_at = now() WHERE id = $1 RETURNING *",
      [req.civId]
    );
    if (!rows[0]) throw httpError(404, "Civilisation introuvable.");
    res.json(civViewModel(rowToCiv(rows[0])));
  } catch (err) {
    next(err);
  }
});

router.post("/me/cards/:cardId/buy", async (req, res, next) => {
  try {
    const civ = await buyCard(req.civId, req.params.cardId);
    res.json(civViewModel(civ));
  } catch (err) {
    next(err);
  }
});

router.post("/me/production", async (req, res, next) => {
  try {
    const { kind, id, tileIndex } = req.body || {};
    const civ = await produce(req.civId, { kind, id, tileIndex });
    res.json(civViewModel(civ));
  } catch (err) {
    next(err);
  }
});

router.get("/me/units/:tileIndex/:unitId/actions", async (req, res, next) => {
  try {
    const civ = await getCivById(req.civId);
    if (!civ) throw httpError(404, "Civilisation introuvable.");
    const tile = civ.map[req.params.tileIndex];
    if (!tile) throw httpError(404, "Tuile introuvable.");
    const unit = tile.units.find((u) => u.id === req.params.unitId);
    if (!unit) throw httpError(404, "Citoyen introuvable.");
    const alreadyActed = (civ.turnState.actedUnitIds || []).includes(unit.id);
    res.json({ actions: alreadyActed ? [] : availableActions(civ, unit.type, tile), alreadyActed });
  } catch (err) {
    next(err);
  }
});

router.post("/me/units/action", async (req, res, next) => {
  try {
    const civ = await getCivById(req.civId);
    if (!civ) throw httpError(404, "Civilisation introuvable.");
    const { tileIndex, unitId, actionKey, targetIndex } = req.body || {};
    const result = runUnitAction({ civ, tileIndex, unitId, actionKey, targetIndex });
    const newTurnState = { ...civ.turnState, actedUnitIds: [...(civ.turnState.actedUnitIds || []), result.actedUnitId] };
    const { rows } = await pool.query(
      "UPDATE civilizations SET map = $2, resources = $3, turn_state = $4, updated_at = now() WHERE id = $1 RETURNING *",
      [req.civId, JSON.stringify(result.map), JSON.stringify(result.resources), JSON.stringify(newTurnState)]
    );
    res.json({ ...civViewModel(rowToCiv(rows[0])), resourceBonusMessage: result.resourceBonusMessage });
  } catch (err) {
    next(err);
  }
});

router.get("/me/harvest-tasks", (req, res) => {
  res.json({ tasks: HARVEST_TASKS });
});

router.post("/me/harvest", async (req, res, next) => {
  try {
    const { completed } = req.body || {};
    const { civ, gains } = await harvest(req.civId, completed);
    res.json({ ...civViewModel(civ), gains });
  } catch (err) {
    next(err);
  }
});

router.get("/me/turn", async (req, res, next) => {
  try {
    const civ = await getCivById(req.civId);
    if (!civ) throw httpError(404, "Civilisation introuvable.");
    const { rows: classRows } = await pool.query("SELECT turns_unlocked FROM classes WHERE id = $1", [civ.classId]);
    const turnsUnlocked = classRows[0]?.turns_unlocked ?? 1;
    const year = yearForTurn(civ.turnNumber);
    res.json({
      turnNumber: civ.turnNumber,
      year,
      yearLabel: formatYear(year),
      epoch: epochForYear(year),
      event: scriptedEventForTurn(civ.turnNumber, civ.id),
      turnsUnlocked,
      canPlay: civ.turnNumber <= turnsUnlocked,
      harvestClaimed: !!civ.turnState.harvestClaimed,
    });
  } catch (err) {
    next(err);
  }
});

function clampResources(resources) {
  const out = {};
  for (const k of Object.keys(resources)) out[k] = Math.max(0, resources[k] ?? 0);
  return out;
}

router.post("/me/turn/advance", async (req, res, next) => {
  try {
    const civ = await getCivById(req.civId);
    if (!civ) throw httpError(404, "Civilisation introuvable.");
    const event = scriptedEventForTurn(civ.turnNumber, civ.id);
    const { eventText, choiceKey } = req.body || {};

    let effect = event?.effect || { resourceDelta: {} };
    let bonheurDelta = 0;
    let chosenLabel = null;

    if (event?.choice) {
      const option = event.choice.options.find((o) => o.key === choiceKey);
      if (!option) throw httpError(400, "Choix invalide pour cette carte historique.");
      effect = option.effect;
      chosenLabel = option.label;
    }
    if (event?.requiresText && (!eventText || eventText.trim().length < 10)) {
      throw httpError(400, "Cette carte historique demande une réflexion écrite d'au moins 10 caractères.");
    }
    bonheurDelta = effect.bonheurDelta || 0;

    const newResources = clampResources({
      ...civ.resources,
      ...Object.fromEntries(
        Object.entries(effect.resourceDelta || {}).map(([k, v]) => [k, (civ.resources[k] ?? 0) + v])
      ),
    });
    const newBonheur = Math.max(0, Math.min(4, civ.bonheurIndex + bonheurDelta));
    const journalEntry = {
      turn: civ.turnNumber,
      eventId: event?.id ?? null,
      eventTitle: event?.title ?? null,
      choiceLabel: chosenLabel,
      text: eventText || null,
      at: new Date().toISOString(),
    };
    const newJournal = [...civ.journal, journalEntry];

    // Some events (e.g. Passage d'un troupeau) place a huntable fauna token on
    // the map instead of granting a resource directly — the reward comes from
    // actually hunting it (see actions.js), on a tile matching the animal's
    // habitat, that doesn't already carry another resource.
    let newMap = civ.map;
    if (event?.spawnsFauna) {
      const resDef = loadContent().mapResourceById.get(event.spawnsFauna);
      if (resDef) {
        const eligible = civ.map
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => !t.resource && resDef.compatibleTerrain.includes(t.terrainId))
          .map(({ i }) => i);
        if (eligible.length) {
          const targetIndex = eligible[Math.floor(Math.random() * eligible.length)];
          newMap = civ.map.map((t, i) => (i === targetIndex ? { ...t, resource: { id: resDef.id, kind: "faune" } } : t));
        }
      }
    }

    const { rows } = await pool.query(
      `UPDATE civilizations SET
         turn_number = turn_number + 1, resources = $2, bonheur_index = $3, journal = $4, map = $5, turn_state = '{}', updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.civId, JSON.stringify(newResources), newBonheur, JSON.stringify(newJournal), JSON.stringify(newMap)]
    );
    res.json(civViewModel(rowToCiv(rows[0])));
  } catch (err) {
    next(err);
  }
});

export default router;
