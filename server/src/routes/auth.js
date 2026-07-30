import { Router } from "express";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { pool } from "../db.js";
import { findOrCreateCiv, civViewModel, httpError } from "../civ.js";

const router = Router();
const nanoJoinCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6); // no O/0/I/1 mix-ups

// Optional lock so random visitors on the deployed URL can't spin up classes.
// Set ADMIN_SECRET in the environment to require it; leave unset to allow it freely.
function checkAdmin(req) {
  if (!process.env.ADMIN_SECRET) return;
  if (req.get("x-admin-secret") !== process.env.ADMIN_SECRET) {
    throw httpError(401, "Clé administrateur invalide.");
  }
}

router.post("/classes", async (req, res, next) => {
  try {
    checkAdmin(req);
    const { className, teacherPasscode } = req.body || {};
    if (!className?.trim() || !teacherPasscode || teacherPasscode.length < 4) {
      throw httpError(400, "Nom de classe et code enseignant (4 caractères min.) requis.");
    }
    const joinCode = nanoJoinCode();
    const hash = await bcrypt.hash(teacherPasscode, 10);
    const { rows } = await pool.query(
      `INSERT INTO classes (name, join_code, teacher_passcode_hash) VALUES ($1, $2, $3) RETURNING id, name, join_code`,
      [className.trim(), joinCode, hash]
    );
    res.json({ classId: rows[0].id, className: rows[0].name, joinCode: rows[0].join_code });
  } catch (err) {
    next(err);
  }
});

router.post("/classes/:joinCode/join", async (req, res, next) => {
  try {
    const { studentName } = req.body || {};
    if (!studentName?.trim()) throw httpError(400, "Nom de l'élève requis.");

    const { rows } = await pool.query("SELECT id, name FROM classes WHERE join_code = $1", [
      req.params.joinCode.toUpperCase(),
    ]);
    if (!rows[0]) throw httpError(404, "Code de classe introuvable.");

    const civ = await findOrCreateCiv(rows[0].id, studentName.trim());
    res.cookie("civ_session", String(civ.id), {
      httpOnly: true,
      signed: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 300,
    });
    res.json({ className: rows[0].name, ...civViewModel(civ) });
  } catch (err) {
    next(err);
  }
});

router.post("/classes/:joinCode/teacher-login", async (req, res, next) => {
  try {
    const { teacherPasscode } = req.body || {};
    const { rows } = await pool.query(
      "SELECT id, name, teacher_passcode_hash FROM classes WHERE join_code = $1",
      [req.params.joinCode.toUpperCase()]
    );
    if (!rows[0]) throw httpError(404, "Code de classe introuvable.");
    const ok = await bcrypt.compare(teacherPasscode || "", rows[0].teacher_passcode_hash);
    if (!ok) throw httpError(401, "Code enseignant invalide.");

    res.cookie("teacher_session", String(rows[0].id), {
      httpOnly: true,
      signed: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 300,
    });
    res.json({ classId: rows[0].id, className: rows[0].name });
  } catch (err) {
    next(err);
  }
});

export default router;
