import { Router } from "express";
import { pool } from "../db.js";
import { getCivById, civViewModel, rowToCiv, httpError } from "../civ.js";
import { cardById } from "../content.js";

const router = Router();

function requireTeacherSession(req, res, next) {
  const classId = req.signedCookies?.teacher_session;
  if (!classId) return next(httpError(401, "Session enseignant manquante — connecte-toi d'abord."));
  req.classId = Number(classId);
  next();
}

router.use(requireTeacherSession);

router.get("/class", async (req, res, next) => {
  try {
    const { rows: classRows } = await pool.query(
      "SELECT id, name, join_code, turns_unlocked FROM classes WHERE id = $1",
      [req.classId]
    );
    if (!classRows[0]) throw httpError(404, "Classe introuvable.");
    const { rows } = await pool.query(
      `SELECT id, student_name, civ_name, turn_number, resources, bonheur_index, onboarded
       FROM civilizations WHERE class_id = $1 ORDER BY student_name`,
      [req.classId]
    );
    res.json({ class: classRows[0], roster: rows });
  } catch (err) {
    next(err);
  }
});

// Turn-pacing control: how many turns the whole class may currently play.
// Defaults to effectively unlimited (999999) when a class is created, so this
// only restricts pacing once a teacher deliberately sets a lower value.
router.post("/class/turns-unlocked", async (req, res, next) => {
  try {
    const turnsUnlocked = Number(req.body?.turnsUnlocked);
    if (!Number.isInteger(turnsUnlocked) || turnsUnlocked < 1) {
      throw httpError(400, "Nombre de tours débloqués invalide.");
    }
    const { rows } = await pool.query(
      "UPDATE classes SET turns_unlocked = $2 WHERE id = $1 RETURNING id, name, turns_unlocked",
      [req.classId, turnsUnlocked]
    );
    if (!rows[0]) throw httpError(404, "Classe introuvable.");
    res.json({ class: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get("/civ/:civId", async (req, res, next) => {
  try {
    const civ = await getCivById(req.params.civId);
    if (!civ || civ.classId !== req.classId) throw httpError(404, "Civilisation introuvable dans cette classe.");
    res.json(civViewModel(civ));
  } catch (err) {
    next(err);
  }
});

// Direct teacher action: credit/debit resources, grant a card outright (bypassing
// cost/prereqs — a deliberate override, not the normal discovery flow), or nudge
// happiness. Any subset of fields may be sent.
router.post("/civ/:civId/grant", async (req, res, next) => {
  try {
    const civ = await getCivById(req.params.civId);
    if (!civ || civ.classId !== req.classId) throw httpError(404, "Civilisation introuvable dans cette classe.");
    const { resourceDelta, cardId, bonheurDelta } = req.body || {};

    let resources = { ...civ.resources };
    if (resourceDelta) {
      for (const [k, v] of Object.entries(resourceDelta)) {
        resources[k] = Math.max(0, (resources[k] ?? 0) + Number(v || 0));
      }
    }
    let ownedCards = civ.ownedCards;
    if (cardId) {
      if (!cardById(cardId)) throw httpError(400, "Carte inconnue.");
      if (!ownedCards.includes(cardId)) ownedCards = [...ownedCards, cardId];
    }
    const bonheurIndex = Math.max(0, Math.min(4, civ.bonheurIndex + Number(bonheurDelta || 0)));

    const { rows } = await pool.query(
      `UPDATE civilizations SET resources = $2, owned_cards = $3, bonheur_index = $4, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [civ.id, JSON.stringify(resources), JSON.stringify(ownedCards), bonheurIndex]
    );
    res.json(civViewModel(rowToCiv(rows[0])));
  } catch (err) {
    next(err);
  }
});

router.post("/civ/:civId/set-turn", async (req, res, next) => {
  try {
    const civ = await getCivById(req.params.civId);
    if (!civ || civ.classId !== req.classId) throw httpError(404, "Civilisation introuvable dans cette classe.");
    const turnNumber = Number(req.body?.turnNumber);
    if (!Number.isInteger(turnNumber) || turnNumber < 1) throw httpError(400, "Numéro de tour invalide.");
    const { rows } = await pool.query(
      "UPDATE civilizations SET turn_number = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [civ.id, turnNumber]
    );
    res.json(civViewModel(rowToCiv(rows[0])));
  } catch (err) {
    next(err);
  }
});

export default router;
