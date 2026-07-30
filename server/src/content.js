// Loads all game content (cards, units, districts, terrain, historical events)
// from the CSV files Aiden edits in cartes/. This is the single "content source" —
// adding or editing a row there and restarting the server is the entire workflow
// for adding a new card, no code changes needed.
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARTES_DIR = path.join(__dirname, "..", "..", "cartes");
const IMAGES_DIR = path.join(CARTES_DIR, "images");
const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function slugify(s) {
  return String(s || "")
    .replace(/['’ʼ]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Same normalization the print pipeline (card-generator/generate_cards.js) uses,
// so a file dropped in cartes/images/ named after a card's title or id is picked
// up automatically here too — one image, both the printed card and the live game.
function normalizeImageKey(s) {
  return String(s || "")
    .replace(/['’ʼ]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

let imageIndex = null;
function buildImageIndex() {
  const idx = new Map();
  if (!fs.existsSync(IMAGES_DIR)) return idx;
  for (const f of fs.readdirSync(IMAGES_DIR)) {
    const ext = path.extname(f).toLowerCase();
    if (!IMG_EXTS.has(ext)) continue;
    idx.set(normalizeImageKey(path.basename(f, ext)), f);
  }
  return idx;
}

function findImageUrl(...candidates) {
  if (!imageIndex) imageIndex = buildImageIndex();
  for (const c of candidates) {
    const file = imageIndex.get(normalizeImageKey(c));
    if (file) return `/images/${encodeURIComponent(file)}`;
  }
  return null;
}

function readCsv(filename) {
  const filePath = path.join(CARTES_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

// "0 (départ)" -> 0, "1" -> 1, "—" -> null
function parseCost(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "—" || s === "-" || s === "") return null;
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function splitList(raw) {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (s === "" || s === "Aucun" || s === "—") return [];
  return s.split(/,|;/).map((x) => x.trim()).filter(Boolean);
}

let cache = null;

export function loadContent({ force = false } = {}) {
  if (cache && !force) return cache;

  const scienceCards = readCsv("Arbre_Scientifique_Era1.csv").map((r) => ({
    id: r.ID || slugify(r.Titre),
    title: r.Titre,
    type: "science",
    era: r["Ère"],
    cost: parseCost(r["Coût_Science"]),
    prerequisites: splitList(r["Prérequis"]),
    description: r["Description_historique"],
    unlocks: r["Débloque"],
    source: r["Source"],
    imageUrl: findImageUrl(r.ID, r.Titre),
  }));

  const cultureCards = readCsv("Arbre_Culturel_Era1.csv").map((r) => ({
    id: r.ID || slugify(r.Titre),
    title: r.Titre,
    type: "culture",
    subtype: r["Sous_type"],
    era: r["Ère"],
    cost: parseCost(r["Coût_Culture"]),
    prerequisites: splitList(r["Prérequis"]),
    description: r["Description_historique"],
    unlocks: r["Débloque"],
    source: r["Source"],
    imageUrl: findImageUrl(r.ID, r.Titre),
  }));

  const units = readCsv("Unites_Era1.csv").map((r) => ({
    id: slugify(r.Titre),
    title: r.Titre,
    unlockedBy: r["Débloqué_par"],
    isStarter: /départ/i.test(r["Débloqué_par"] || ""),
    costFirst: parseCost(r["Coût_1re_copie"]),
    costNextRaw: r["Coût_copies_suivantes"],
    costType: (r["Type_coût"] || "").toLowerCase(), // "nourriture"
    actions: splitList(r["Actions"]),
    description: r["Description_historique"],
    evolvesTo: r["Évolue_vers"],
    source: r["Source"],
    imageUrl: findImageUrl(r.Titre),
  }));

  const districts = readCsv("Districts_Batiments.csv").map((r) => ({
    id: slugify(r.Nom),
    kind: r.Type, // "District" | "Bâtiment"
    title: r.Nom,
    parentDistrict: r["Quartier_parent"] && r["Quartier_parent"] !== "—" ? slugify(r["Quartier_parent"]) : null,
    unlockedBy: r["Débloqué_par"],
    costProduction: parseCost(r["Coût_Production"]),
    effect: r.Effet,
    minSettlementTier: r["Palier_établissement_minimum"],
    era: r["Ère_de_déblocage"],
    imageUrl: findImageUrl(r.Nom),
  }));

  const territoireRows = readCsv("Territoire.csv").filter(
    (r) => r.Nom && !String(r.Description || "").startsWith("VOLONTAIREMENT")
  );
  const biomeRows = readCsv("Territoire_Biomes_Era1.csv");
  const territoires = [...biomeRows, ...territoireRows].map((r) => ({
    id: slugify(r.Nom),
    title: r.Nom,
    description: r.Description,
    imageUrl: findImageUrl(r.Image_clé, r.Nom),
  }));

  const historicalEvents = readCsv("Cartes_Historiques_Era1.csv").map((r) => ({
    id: slugify(r.Titre),
    title: r.Titre,
    trigger: r["Déclencheur"],
    effect: r.Effet,
    pdaLink: r["Lien_PDA"],
    source: r["Source_citation"],
  }));

  cache = {
    scienceCards,
    cultureCards,
    units,
    districts,
    territoires,
    historicalEvents,
    scienceById: new Map(scienceCards.map((c) => [c.id, c])),
    cultureById: new Map(cultureCards.map((c) => [c.id, c])),
    unitById: new Map(units.map((u) => [u.id, u])),
    districtById: new Map(districts.map((d) => [d.id, d])),
    territoireById: new Map(territoires.map((t) => [t.id, t])),
  };
  return cache;
}

export function allCards() {
  const c = loadContent();
  return [...c.scienceCards, ...c.cultureCards];
}

export function cardById(id) {
  const c = loadContent();
  return c.scienceById.get(id) || c.cultureById.get(id) || null;
}
