import { Router } from "express";
import { pool } from "../db.js";
import { getCivById, onboardCiv, civViewModel, buyCard, produce, httpError, rowToCiv } from "../civ.js";
import { availableActions, runUnitAction } from "../actions.js";
import { scriptedEventForTurn } from "../events.js";
import { yearForTurn, epochForYear, formatYear } from "../turns.js";

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
    if (!unit) throw httpError(404, "Unité introuvable.");
    res.json({ actions: availableActions(unit.type) });
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
    const { rows } = await pool.query(
      "UPDATE civilizations SET map = $2, resources = $3, updated_at = now() WHERE id = $1 RETURNING *",
      [req.civId, JSON.stringify(result.map), JSON.stringify(result.resources)]
    );
    res.json(civViewModel(rowToCiv(rows[0])));
  } catch (err) {
    next(err);
  }
});

router.get("/me/turn", async (req, res, next) => {
  try {
    const civ = await getCivById(req.civId);
    if (!civ) throw httpError(404, "Civilisation introuvable.");
    const year = yearForTurn(civ.turnNumber);
    res.json({
      turnNumber: civ.turnNumber,
      year,
      yearLabel: formatYear(year),
      epoch: epochForYear(year),
      event: scriptedEventForTurn(civ.turnNumber),
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
    const event = scriptedEventForTurn(civ.turnNumber);
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

    const { rows } = await pool.query(
      `UPDATE civilizations SET
         turn_number = turn_number + 1, resources = $2, bonheur_index = $3, journal = $4, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.civId, JSON.stringify(newResources), newBonheur, JSON.stringify(newJournal)]
    );
    res.json(civViewModel(rowToCiv(rows[0])));
  } catch (err) {
    next(err);
  }
});

export default router;
