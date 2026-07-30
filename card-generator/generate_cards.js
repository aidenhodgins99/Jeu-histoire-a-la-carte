// Usage: node generate_cards.js <chemin_csv> <nom_sortie> [nombre_de_lignes]
// Exemple: node generate_cards.js "../cartes/Arbre_Scientifique_Era1.csv" arbre_scientifique_era1 9

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const puppeteer = require("puppeteer");
const { parse } = require("csv-parse/sync");

// Chemin vers ImageMagick (installé via winget) — utilisé pour lire les dimensions réelles des images
const MAGICK_CANDIDATES = [
  "C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\magick.exe",
  "magick",
];
function findMagick() {
  for (const c of MAGICK_CANDIDATES) {
    try {
      execFileSync(c, ["-version"], { stdio: "ignore" });
      return c;
    } catch (e) {}
  }
  return null;
}
const MAGICK_BIN = findMagick();

const imageDimCache = new Map();
function getImageDims(imgPath) {
  if (imageDimCache.has(imgPath)) return imageDimCache.get(imgPath);
  let dims = null;
  if (MAGICK_BIN) {
    try {
      const out = execFileSync(MAGICK_BIN, ["identify", "-format", "%w %h", imgPath]).toString().trim();
      const [w, h] = out.split(/\s+/).map(Number);
      if (w && h) dims = { w, h };
    } catch (e) {
      console.warn(`Impossible de lire les dimensions de ${imgPath} : ${e.message}`);
    }
  }
  imageDimCache.set(imgPath, dims);
  return dims;
}

const [, , csvArg, outArg, limitArg] = process.argv;
if (!csvArg || !outArg) {
  console.error("Usage: node generate_cards.js <chemin_csv> <nom_sortie> [nombre_de_lignes]");
  process.exit(1);
}

const IMAGES_DIR = path.resolve(__dirname, "../cartes/images");
const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function normalizeKey(s) {
  return String(s || "")
    .replace(/['’ʼ]/g, "") // enlève les apostrophes avant tout (d'échange -> déchange, pas "d echange")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // enlève les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Index (construit une seule fois) : clé normalisée -> chemin du fichier image.
// Permet de faire correspondre un fichier nommé d'après le TITRE affiché de la carte
// (ex. "Vêtements de cuir.jpg") aussi bien qu'un fichier nommé d'après l'ID interne (ex. "outils.jpg").
let imageIndex = null;
function buildImageIndex() {
  const idx = new Map();
  if (!fs.existsSync(IMAGES_DIR)) return idx;
  for (const f of fs.readdirSync(IMAGES_DIR)) {
    const ext = path.extname(f).toLowerCase();
    if (!IMG_EXTS.has(ext)) continue;
    const key = normalizeKey(path.basename(f, ext));
    idx.set(key, path.join(IMAGES_DIR, f));
  }
  return idx;
}

function findImage(row) {
  if (!imageIndex) imageIndex = buildImageIndex();
  const candidates = [row.ID, row.Titre, row.Nom].filter(Boolean).map(normalizeKey);
  for (const c of candidates) {
    if (imageIndex.has(c)) return imageIndex.get(c);
  }
  return null;
}

const CARD_W_MM = 60;
const CARD_H_MM = 85;
const GAP_MM = 3;
const COLS = 3;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;
const CARD_PADDING_MM = 2; // doit correspondre à .card { padding: 2mm }
const FRAME_H_MM = 23; // doit correspondre à .tc-frame { flex: 0 0 23mm }
const FRAME_W_MM = CARD_W_MM - 2 * CARD_PADDING_MM;
const FRAME_ASPECT = FRAME_W_MM / FRAME_H_MM; // ≈ 2.43 (cadre large)

// Une image aussi large ou plus large que le cadre peut le remplir entièrement (cover)
// sans perdre de contenu important en haut/bas. Une image plus carrée ou verticale
// serait mal recadrée par "cover" (voir le problème du biface) : on utilise "contain" à la place.
function chooseObjectFit(imgPath) {
  const dims = getImageDims(imgPath);
  if (!dims) return "contain"; // par défaut prudent si on ne peut pas mesurer l'image
  const imgAspect = dims.w / dims.h;
  return imgAspect >= FRAME_ASPECT ? "cover" : "contain";
}

const RES_META = {
  Science: { ic: "🔬", cls: "science", label: "Science" },
  Culture: { ic: "🎭", cls: "culture", label: "Culture" },
  Production: { ic: "🔨", cls: "production", label: "Production" },
  Argent: { ic: "🪙", cls: "argent", label: "Argent" },
  Nourriture: { ic: "🌾", cls: "nourriture", label: "Nourriture" },
};

function findCostColumn(row) {
  for (const key of Object.keys(row)) {
    const m = key.match(/^Coût(?:_|$)(Science|Culture|Production|Argent|Nourriture)?/i);
    if (m) {
      const val = row[key];
      let resType = m[1];
      if (!resType) {
        for (const r of Object.keys(RES_META)) if (key.toLowerCase().includes(r.toLowerCase())) resType = r;
      }
      if (val !== undefined && val !== "") return { value: val, resType: resType || "Science" };
    }
  }
  return null;
}

function pick(row, names) {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== "" && row[n] !== "—") return row[n];
  }
  return "";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cardHtml(row, index) {
  const title = pick(row, ["Titre", "Nom"]) || `Carte ${index + 1}`;
  const eyebrow = pick(row, ["Ère", "Type", "Sous_type", "Type_proposé", "Catégorie_proposée"]);
  let dateTag = pick(row, ["Repère_chronologique", "Déclencheur"]);
  if (dateTag) dateTag = dateTag.split("(")[0].trim();
  const desc = pick(row, [
    "Description_historique",
    "Description_historique_(brouillon)",
    "Effet",
    "Effet_ou_rôle_dans_le_jeu_(proposition)",
  ]);
  const cost = findCostColumn(row);
  const costMeta = cost ? RES_META[cost.resType] || RES_META.Science : null;
  const frameClass = costMeta ? costMeta.cls : "science";
  const unlocks = pick(row, ["Débloque", "Effet_ou_rôle_dans_le_jeu_(proposition)"]);
  const imgPath = findImage(row);
  const objectFit = imgPath ? chooseObjectFit(imgPath) : null;
  const frameInner = imgPath
    ? `<img class="tc-img" style="object-fit:${objectFit};" src="file:///${imgPath.replace(/\\/g, "/")}" alt="">`
    : `<span class="tc-frame-label">Image à intégrer</span><span class="tc-frame-hex">⬡</span>`;

  return `
  <div class="card">
    <div class="tc-frame ${frameClass} ${imgPath ? "has-img" : ""}">
      ${frameInner}
    </div>
    <div class="tc-body">
      ${eyebrow ? `<div class="tc-eyebrow">${escapeHtml(eyebrow)}</div>` : ""}
      <div class="tc-title">${escapeHtml(title)}</div>
      ${dateTag ? `<div class="tc-date">${escapeHtml(dateTag)}</div>` : ""}
      <div class="tc-desc">${escapeHtml(desc)}</div>
    </div>
    ${unlocks ? `<div class="tc-unlock"><span class="tc-unlock-ic">🔓</span> ${escapeHtml(unlocks)}</div>` : ""}
    <div class="tc-foot ${frameClass}">
      <span>${costMeta ? `${costMeta.ic} ${escapeHtml(cost.value)}` : ""}</span>
      <span class="tc-hex">⬡</span>
    </div>
  </div>`;
}

function pageHtml(rows) {
  const cards = rows.map(cardHtml).join("\n");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Planche de cartes</title>
<style>
  :root {
    --parchment: #ede3c7;
    --charcoal: #2b231c;
    --charcoal-soft: #55493a;
    --ochre: #b5651d;
    --verdigris: #5c7a5e;
    --woad: #3e5c76;
    --tyrian: #6b3b5c;
    --gold: #a6832a;
    --line: #c9b98d;
    --card-bg: #faf5e6;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #6b6b6b;
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  }
  @page { size: letter; margin: 6mm; }
  .sheet {
    width: ${COLS * CARD_W_MM + (COLS - 1) * GAP_MM}mm;
    display: flex;
    flex-wrap: wrap;
    gap: ${GAP_MM}mm;
    margin: 20mm auto;
    background: #ffffff;
    padding: 10mm;
    box-shadow: 0 0 0 1px #999, 0 10px 30px rgba(0,0,0,0.35);
  }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; padding: 0; }
  }
  .card {
    width: ${CARD_W_MM}mm;
    height: ${CARD_H_MM}mm;
    background: var(--card-bg);
    border: 0.3mm solid var(--line);
    border-radius: 2mm;
    padding: 2mm;
    display: flex;
    flex-direction: column;
    gap: 1.4mm;
    position: relative;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
    overflow: hidden;
  }
  .card::before, .card::after {
    content: "";
    position: absolute;
    width: 2.4mm; height: 2.4mm;
    border-color: var(--ochre);
    opacity: 0.55;
  }
  .card::before { top: 1.3mm; left: 1.3mm; border-top: 0.4mm solid; border-left: 0.4mm solid; }
  .card::after { bottom: 1.3mm; right: 1.3mm; border-bottom: 0.4mm solid; border-right: 0.4mm solid; }

  .tc-frame {
    flex: 0 0 23mm;
    border-radius: 1.4mm;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1mm;
    overflow: hidden;
  }
  .tc-frame.has-img { padding: 0; }
  .tc-img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .tc-frame-label { font-size: 6.2pt; color: rgba(43,35,28,0.55); font-style: italic; }
  .tc-frame-hex { font-size: 14pt; opacity: 0.3; }
  .tc-frame.science { background: color-mix(in srgb, var(--woad) 22%, var(--card-bg)); }
  .tc-frame.culture { background: color-mix(in srgb, var(--tyrian) 22%, var(--card-bg)); }
  .tc-frame.production { background: color-mix(in srgb, var(--ochre) 22%, var(--card-bg)); }
  .tc-frame.argent { background: color-mix(in srgb, var(--gold) 22%, var(--card-bg)); }
  .tc-frame.nourriture { background: color-mix(in srgb, var(--verdigris) 22%, var(--card-bg)); }

  .tc-body { display: flex; flex-direction: column; gap: 0.8mm; }
  .tc-unlock {
    font-size: 6.2pt; line-height: 1.22; color: var(--charcoal-soft); font-style: italic;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
    flex: 0 0 auto;
  }
  .tc-unlock-ic { font-style: normal; }
  .tc-eyebrow { font-size: 6pt; text-transform: uppercase; letter-spacing: 0.05em; color: var(--charcoal-soft); font-weight: 700; }
  .tc-title {
    font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    font-weight: 700; font-size: 10pt; color: var(--charcoal); line-height: 1.15;
  }
  .tc-date { font-size: 6.4pt; font-style: italic; color: var(--ochre); }
  .tc-desc {
    font-size: 7.3pt; line-height: 1.28; color: var(--charcoal);
    overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 7;
  }

  .tc-foot {
    flex: 0 0 auto;
    margin-top: auto;
    display: flex; align-items: center; justify-content: space-between;
    border-top: 0.25mm solid var(--line); padding-top: 1mm;
    font-size: 8pt; font-weight: 700;
  }
  .tc-foot.science { color: var(--woad); }
  .tc-foot.culture { color: var(--tyrian); }
  .tc-foot.production { color: var(--ochre); }
  .tc-foot.argent { color: var(--gold); }
  .tc-foot.nourriture { color: var(--verdigris); }
  .tc-hex { opacity: 0.4; }
</style>
</head>
<body>
  <div class="sheet">
    ${cards}
  </div>
</body>
</html>`;
}

async function main() {
  const csvPath = path.resolve(__dirname, csvArg);
  const raw = fs.readFileSync(csvPath, "utf8");
  const records = parse(raw, { columns: true, skip_empty_lines: true, bom: true });
  const limit = limitArg ? parseInt(limitArg, 10) : records.length;
  const rows = records.slice(0, limit);

  const outDir = path.resolve(__dirname, "output");
  fs.mkdirSync(outDir, { recursive: true });

  const pages = [];
  for (let i = 0; i < rows.length; i += PER_PAGE) pages.push(rows.slice(i, i + PER_PAGE));

  // Une page HTML par planche de 9, concaténées pour l'aperçu + impression multi-page
  const fullHtml = pages
    .map((pageRows) => pageHtml(pageRows))
    .join('\n<div style="page-break-after: always;"></div>\n')
    // pageHtml() renvoie un document complet par page ; on ne garde qu'un seul <head>
    ;

  // Génère un document unique avec plusieurs <div class="sheet"> (une par page de 9)
  const singleDocHtml = pages.length
    ? pageHtml(pages[0]).replace(
        "</body>",
        pages
          .slice(1)
          .map((pageRows) => {
            const cards = pageRows.map(cardHtml).join("\n");
            return `<div class="sheet" style="page-break-before: always;">${cards}</div>`;
          })
          .join("\n") + "\n</body>"
      )
    : pageHtml([]);

  const htmlPath = path.join(outDir, `${outArg}.html`);
  fs.writeFileSync(htmlPath, singleDocHtml, "utf8");
  console.log(`HTML écrit : ${htmlPath} (${rows.length} carte(s), ${pages.length} page(s))`);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("file://" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle0" });
  const pdfPath = path.join(outDir, `${outArg}.pdf`);
  await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log(`PDF écrit : ${pdfPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
