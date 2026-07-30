import { loadContent, cardById } from "./content.js";
import { generateStartingMap, CENTER_INDEX } from "./map.js";
import { unlockedContent, unitCopyCost, isRequirementSatisfied } from "./rules.js";
import { pool } from "./db.js";

const STARTER_CARD_IDS = ["langage_cult", "taille_pierre"];
const STARTER_UNIT_ID = "chasseur_cueilleur";
const DEFAULT_RESOURCES = { nourriture: 3, production: 0, argent: 0, science: 0, culture: 0 };

export function rowToCiv(row) {
  return {
    id: row.id,
    classId: row.class_id,
    studentName: row.student_name,
    civName: row.civ_name,
    languageName: row.language_name,
    turnNumber: row.turn_number,
    resources: row.resources,
    bonheurIndex: row.bonheur_index,
    croyance: row.croyance,
    gouvernance: row.gouvernance,
    ownedCards: row.owned_cards,
    builtDistricts: row.built_districts,
    map: row.map,
    journal: row.journal,
    eventState: row.event_state,
    tutorialSeen: row.tutorial_seen,
    onboarded: row.onboarded,
  };
}

export async function getCivById(civId) {
  const { rows } = await pool.query("SELECT * FROM civilizations WHERE id = $1", [civId]);
  return rows[0] ? rowToCiv(rows[0]) : null;
}

export async function findOrCreateCiv(classId, studentName) {
  const existing = await pool.query(
    "SELECT * FROM civilizations WHERE class_id = $1 AND student_name = $2",
    [classId, studentName]
  );
  if (existing.rows[0]) return rowToCiv(existing.rows[0]);

  const inserted = await pool.query(
    `INSERT INTO civilizations (class_id, student_name, resources) VALUES ($1, $2, $3) RETURNING *`,
    [classId, studentName, DEFAULT_RESOURCES]
  );
  return rowToCiv(inserted.rows[0]);
}

// The "epic opening" step: name your civilization + your language, then the
// starting state is seeded — Langage + Taille de la pierre owned, one
// Chasseur-Cueilleur on the center Territoire forestier tile, 8 tiles around it.
export async function onboardCiv(civId, { civName, languageName }) {
  const civ = await getCivById(civId);
  if (!civ) throw httpError(404, "Civilisation introuvable.");
  if (civ.onboarded) throw httpError(400, "Cette civilisation a déjà été fondée.");
  if (!civName?.trim() || !languageName?.trim()) {
    throw httpError(400, "Le nom de la civilisation et le nom de la langue sont requis.");
  }

  const map = generateStartingMap({ starterUnitId: STARTER_UNIT_ID });
  const { rows } = await pool.query(
    `UPDATE civilizations SET
       civ_name = $2, language_name = $3, owned_cards = $4, map = $5,
       onboarded = true, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [civId, civName.trim(), languageName.trim(), JSON.stringify(STARTER_CARD_IDS), JSON.stringify(map)]
  );
  return rowToCiv(rows[0]);
}

export function civViewModel(civ) {
  const content = loadContent();
  const unlocked = civ.onboarded ? unlockedContent(civ.ownedCards) : { discoverableCards: [], unlockedUnits: [], unlockedDistricts: [] };
  return {
    civ,
    content: {
      territoires: content.territoires,
    },
    discoverableCards: unlocked.discoverableCards,
    unlockedUnits: unlocked.unlockedUnits,
    unlockedDistricts: unlocked.unlockedDistricts,
    ownedCardDetails: civ.ownedCards.map((id) => cardById(id)).filter(Boolean),
  };
}

export async function buyCard(civId, cardId) {
  const civ = await getCivById(civId);
  if (!civ) throw httpError(404, "Civilisation introuvable.");
  const card = cardById(cardId);
  if (!card) throw httpError(404, "Carte introuvable.");
  if (civ.ownedCards.includes(cardId)) throw httpError(400, "Cette carte est déjà découverte.");

  const missingPrereq = card.prerequisites.find((p) => !isRequirementSatisfied(p, civ.ownedCards));
  if (missingPrereq) throw httpError(400, `Prérequis manquant : ${missingPrereq}`);

  const resourceKey = card.type === "science" ? "science" : "culture";
  const cost = card.cost ?? 0;
  if ((civ.resources[resourceKey] ?? 0) < cost) {
    throw httpError(400, `Pas assez de ${resourceKey === "science" ? "Science" : "Culture"} (${cost} requis).`);
  }

  const newResources = { ...civ.resources, [resourceKey]: civ.resources[resourceKey] - cost };
  const newOwned = [...civ.ownedCards, cardId];
  const { rows } = await pool.query(
    `UPDATE civilizations SET resources = $2, owned_cards = $3, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [civId, JSON.stringify(newResources), JSON.stringify(newOwned)]
  );
  return rowToCiv(rows[0]);
}

// Production de l'établissement: build a unit (costs Nourriture, placed on a tile
// that already has one of the civ's units) or a district/building (costs Production).
export async function produce(civId, { kind, id, tileIndex }) {
  const civ = await getCivById(civId);
  if (!civ) throw httpError(404, "Civilisation introuvable.");
  const { unlockedUnits, unlockedDistricts } = unlockedContent(civ.ownedCards);

  if (kind === "unit") {
    const unit = unlockedUnits.find((u) => u.id === id);
    if (!unit) throw httpError(400, "Cette unité n'a pas encore été découverte.");
    const tile = civ.map[tileIndex];
    if (!tile) throw httpError(400, "Tuile invalide.");
    if (!tile.units.length && !unit.isStarter) {
      throw httpError(400, "Une nouvelle unité doit être produite sur une tuile déjà occupée par votre civilisation.");
    }
    const copiesOwned = civ.map.reduce((n, t) => n + t.units.filter((u) => u.type === id).length, 0);
    const cost = unitCopyCost(unit, copiesOwned);
    if ((civ.resources.nourriture ?? 0) < cost) throw httpError(400, `Pas assez de Nourriture (${cost} requis).`);

    const newMap = civ.map.map((t, i) =>
      i === Number(tileIndex) ? { ...t, units: [...t.units, { id: `u${Date.now()}`, type: id }] } : t
    );
    const newResources = { ...civ.resources, nourriture: civ.resources.nourriture - cost };
    const { rows } = await pool.query(
      `UPDATE civilizations SET resources = $2, map = $3, updated_at = now() WHERE id = $1 RETURNING *`,
      [civId, JSON.stringify(newResources), JSON.stringify(newMap)]
    );
    return rowToCiv(rows[0]);
  }

  if (kind === "district") {
    const district = unlockedDistricts.find((d) => d.id === id);
    if (!district) throw httpError(400, "Ce district/bâtiment n'a pas encore été découvert.");
    if (civ.builtDistricts.includes(id)) throw httpError(400, "Déjà construit.");
    const cost = district.costProduction ?? 0;
    if ((civ.resources.production ?? 0) < cost) throw httpError(400, `Pas assez de Production (${cost} requis).`);

    const newResources = { ...civ.resources, production: civ.resources.production - cost };
    const newBuilt = [...civ.builtDistricts, id];
    const { rows } = await pool.query(
      `UPDATE civilizations SET resources = $2, built_districts = $3, updated_at = now() WHERE id = $1 RETURNING *`,
      [civId, JSON.stringify(newResources), JSON.stringify(newBuilt)]
    );
    return rowToCiv(rows[0]);
  }

  throw httpError(400, "Type de production invalide.");
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export { CENTER_INDEX };
