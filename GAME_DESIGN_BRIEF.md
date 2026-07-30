# Civilisation en classe — Design Brief for Claude Code

## Source material
This brief consolidates a long design conversation between Aiden (the teacher/owner) and Claude
(chat: "Designing a civilization history game for secondary students",
https://claude.ai/share/7f829083-64f4-4b1c-9047-9e7f856ed23d). That conversation ended with Claude
itself recommending the move into Claude Code for exactly this kind of long-running,
file-heavy production work (spreadsheet + Python + PDF pipeline), which is why this project exists.

**Missing piece:** there is also a Claude Design project ("Feuille de jeu - Tableau de bord.dc.html")
that reportedly contains a prototype of the digital turn-sheet/dashboard UI. I could not access it
(private, requires Aiden's claude.ai login, and no authenticated browser session was available). If
that prototype still matters, Aiden should export/paste its HTML or describe its layout so it can be
used as a starting point for the dashboard instead of building one from scratch.

## Who this is for
Aiden is a Quebec secondary-school (grades 7–11 / Secondary 1–5) history & geography teacher, not a
programmer. Claude Code should treat itself as the sole engineer: propose concrete plans, do the
implementation, and explain trade-offs in plain language rather than assuming coding literacy.

## What the game is
"Write your own story" — a cooperative-ish, competitive-ish Civilization-style board/video game
hybrid where student teams guide a civilization from the Paleolithic to (eventually) the present,
earning resources through classroom learning and spending them on cards, units, and city-building.
It is designed to run as a **year-long (eventually multi-year) classroom routine**, ~15 minutes of
most class periods, not a standalone video game session.

### Format: hybrid, not purely digital
- Must be fully playable on paper with zero devices (index-card-style cards in trading-card
  sleeves, a printed/hand-drawn hex map, a paper "feuille de tour" turn sheet).
- Must also have a digital layer: a scorekeeper/quiz engine/dashboard ("tableau de bord") that the
  teacher (and, when devices are available, students) can use — tracking multiple **independent,
  simultaneous games** (4–6 classes/sections per year, 15–32 students each, some running solo
  before merging into teams).
- Teacher retains "god mode": manual point-crediting for anything done outside the app (textbook
  work, i+ Interactif platform, Kahoot/Wordwall/Genially/Google Forms — none of these can be
  auto-integrated; Claude confirmed no API/export access exists for any of them), event overrides,
  and balancing levers.

## Core loop (per class session, ~15 min)
1. Quiz du jour (5–10 min) + any teacher-credited work (workbook/i+/test/reading) → awards Science,
   Culture, and/or Cash points at the start of the session.
2. Student reviews their dashboard/feuille de tour (resources, government/belief cards in play,
   settlements, districts, buildings, units, discovered-card library).
3. Student may: swap belief/governance cards, choose a production/purchase per settlement, move or
   act each unit once (roughly one action per unit per class, not per calendar "turn").
4. Depending on decisions/context/teacher call, a **carte historique** (event card) may be dealt,
   with a positive or negative effect.
5. If time remains, optional bonus tasks for extra points.

Design decision already made: **1 Turn = 1 class session**, not a fixed calendar week — each
class's game clock runs independently, since Secondary 1–2 meets far more often per year than
Secondary 3–5. Content pacing must track "era reached" per class, not a shared calendar.

## Point economies (final, as revised from the original 4-resource idea)
- **Nourriture (Food)** — from hunting/gathering, later agriculture/tile improvements. Drives
  settlement population (city-size tiers).
- **Production** — from hunting/tanning/woodcutting early, later mines/pastures/lumber camps once
  unlocked. Spent on units, districts, buildings, wonders.
- **Cash** — separate from Production; both can independently buy units/buildings.
- **Science** — unlocks the scientific/technology tree.
- **Culture** — unlocks the cultural tree (which itself branches into beliefs and governance).
  (Faith was deliberately *merged into Culture*, not kept separate.)
- **Bonheur (Happiness)** — a 5-tier **mood indicator shown only as an emoji**, never a raw number,
  0–100 internally:
  - 😡 Révolte (0–19): major penalty, risk of schism/desertion
  - 🙁 Mécontent (20–39): −10% all yields
  - 😐 Neutre (40–59): no effect
  - 🙂 Content (60–79): +10% all yields
  - 😄 Âge d'or (80–100): +20% all yields, unlocks special "Âge d'or" card

**Anti-snowball rule (must be preserved in all future content):** anything free or flat-cost is a
snowball risk. Starting units (1 Chasseur + 1 Cueilleuse) are free; every subsequent unit scales in
Production cost (e.g., 3rd = 4, 4th = 6, 5th = 9…). Apply the same scaling discipline to all new
mechanics.

## Map
Two-tier system to solve "25 student teams, Civ-VI-scale map":
- **Regional sub-maps**: each historically grounded starting cradle (Croissant fertile, vallée du
  Nil, vallée de l'Indus, fleuve Jaune, Mésoamérique, Andes, etc.) is its own small zoomed-in hex
  grid sized for the handful of teams that start there. Early tribal movement, foraging, and
  inter-tribe events happen here, with limited/expanding vision (fog of war).
- **World map**: uncluttered; a civilization only appears on it once it crosses a size/era
  threshold (e.g., reaches City tier), mirroring real history.
- Real Earth geography, hex tiles, terrain types (grassland, plains, desert, forest, rainforest,
  mountain, tundra, hills, water, snow, ice, etc.).
- No civilization can ever be eliminated — an "Exode"/miracle card always lets a losing civilization
  survive somewhere. Warfare is allowed but penalized by the teacher/system; peaceful civs get a
  developmental edge, incentivizing negotiation over conflict.

## Settlements, districts, buildings
- Settlement tiers mirror **real UN city-population classifications** (verify exact current UN
  thresholds when implementing): Campement → Village → Bourg → Ville → Métropole (≥1M) →
  Mégapole (≥10M, per UN definition).
- District slots scale 1:1 with settlement tier (tier 1 settlement = 1 district slot, up to 6).
- 8 district types: Site saint, Site/Complexe culturel, Campus, Zone commerciale, Port, Zone
  industrielle, Fort/Base militaire, **Complexe de divertissement** (restored — produces Bonheur +
  Culture; do not drop this again).
- No hard cap on buildings per district — students are naturally limited by what they've
  discovered/unlocked.
- Forts/military bases cost Cash upkeep and produce **no** economic yield (purely defensive) — a
  deliberate reversal from an earlier draft.
- Settlements/districts/buildings are physically stacked cards on the paper feuille de tour (not a
  spread-out tableau) — this stacking metaphor should carry into any digital UI too.
- Students name their own settlements.

## Card system
Six categories, each card needs: **titre, type, image, description historique** (grounded in
reliable/citable sources — Alloprof, the Quebec PDA/curriculum documents, encyclopedias, books —
not invented), **effets/coûts**, other info as needed. Game text is **entirely in French**.

1. **Cartes scientifiques** (tech tree) — modeled on Civ VI's tech tree, remapped onto Quebec's
   history "progression des apprentissages" (PDA).
2. **Cartes culturelles** (civic tree, incl. sub-types: **croyance** and **gouvernance**) — modeled
   on Civ VI's civics/policy tree, same PDA remapping. Governance cards have limited equip slots
   that grow over time (1 slot in Paléolithique, 2–3 in Néolithique, etc.).
3. **Cartes unités** — workers/warriors/leaders etc., unlocked by science/culture/historical cards,
   bought with Production or Cash, act once per class on the map.
4. **Cartes établissement / quartier / bâtiment** — not "played" like action cards; they're
   discovered/purchased and stacked to accumulate yields.
5. **Cartes historiques** (event cards) — dealt by the game/teacher based on decisions or curriculum
   tie-ins (not purchasable). Each is explicitly mapped to a PDA learning objective (a
   "Lien avec le PDA" column already exists in the data for this). Later-era historical cards let
   students "meet" real historical civilizations — researching them properly should give a bonus,
   under-preparing a penalty (mechanism still undesigned).
6. **Cartes territoire** (geography-PDA tie-in) — territoire agricole, urbain, autochtone, région
   (énergétique/forestier/industriel/tourisme), protégé.
   ⚠️ **Sensitivity flag already raised and accepted:** *territoire autochtone* must NOT be
   implemented as a Paleolithic/prehistoric map mechanic — the real PDA content is about
   contemporary Northern Indigenous nations and real treaties. Treat it as its own
   contemporary case-study module in a later era, not something bolted onto the early game.
7. **Grands personnages** (great people) — another PDA-integration vector; correctly has zero
   entries in Era 1 (prehistoric individuals aren't named in the historical record — treated as a
   deliberate teaching moment tied to the "Écriture" tech node). First entries (Hammurabi,
   Gilgamesh) belong to Chapter 2.

### Physical card spec
- **63 × 88 mm** (standard trading-card size — fits standard 9-pocket sleeves holding cards up to
  63.5 × 88.9 mm). This is the locked spec; do not regress to the earlier 70×100 "hero card" size.
- Batch-generated as print-ready PDF sheets, 9 cards/page (3×3 grid), US Letter.
- Visual language established: parchment/ochre/charcoal palette (cave-pigment inspired: red ochre,
  iron oxide), carved-stone corner ticks, serif title font (Lora) with wide letter-spacing, small
  hexagon icons in the footer as a cross-category "signature" motif tying every card back to the
  hex map. Later eras will need their own era-appropriate art direction (this look is Paleolithic-
  specific).
- Images: real public-domain / CC photos preferred over AI-generated art where practical (e.g., the
  approved Lascaux cave-art photo). AI-generated art (Craiyon/Freepik free tier) is acceptable but
  requires an attribution credit line in the rulebook, and a paid tier should be considered before
  scaling to hundreds of cards for watermark/licensing cleanliness. No live internet fetch is
  assumed to exist in the build environment — image sourcing may still require a manual
  upload/approve step from Aiden unless Claude Code's environment has real web access, in which
  case that friction can likely be removed.
- Card copy source-of-truth is a spreadsheet (`banque_cartes.xlsx` in the old chat's workflow) with
  one tab per card category, one row per card — Aiden edits cells directly, regeneration is a
  scripted batch job. Preserve this "spreadsheet is truth, script renders PDF" pattern; it's the
  part of the old workflow that worked well. A **known gotcha**: the previous environment's
  `wkhtmltopdf` silently rendered ~23% smaller than declared page size (fixed with an empirical
  1.3036 scale correction) and doesn't support CSS Grid (flexbox also proved unreliable — the
  working layout used raw `inline-block` with fixed mm dimensions). Whatever PDF pipeline Claude
  Code sets up, verify actual physical output dimensions rather than trusting the CSS declaration.

## Era 1 (Paléolithique/Néolithique) — fully specified content exists
Two full trees (Science + Culture/Croyance/Gouvernance) were built out for Era 1 as the template
pattern for all future eras, including full historical-description text for every node. Roughly 16
science nodes / 11 culture nodes, ~106 Science + 109 Culture points to fully clear the era. Known
nodes include (non-exhaustive): langage, feu, outils, cuisine, chasse, pêche, navigation marine,
travail du bois, vêtements de cuir, lance, projectiles (arc), domestication des chiens, agriculture,
élevage, exploitation minière, poterie, écriture, spiritualité (renamed from "croyance organisée"),
tradition orale, troc et réseaux d'échange, enterrement et tombeaux/sépultures, mégalithes, musique
et instruments, lois, division du travail. Units include Chasseur/Cueilleuse → Travailleur
(post-Agriculture), Lancier → Guerrier (post-bronze), Colon/Settler, Artisan, Prophète, Agriculteur
(a stationed specialist distinct from Travailleur), Explorateur, Bateaux, Archer. Governance slots:
Chefferie (Paléo, slot 1) → Conseil des anciens (Néo, slot 2) → Conseil de village (Néo, tier
Village+, slot 3).

## Year‑1 rollout plan (already decided)
Year 1 will run **Secondary 1 only**, following the Secondary 1 textbook's 6 chapters rather than
the original 11-era/36-week arc (that longer structure remains the long-term multi-year plan once
Sec 2–5 join):

| Chapitre | Contenu | Classes ciblées |
|---|---|---|
| 1 | La sédentarisation (Paléo/Néo) | ~19–20 |
| 2 | Premières civilisations (Mésopotamie, Nil, Chine, Indus) | ~18 |
| 3 | Antiquité classique (Grèce, Athènes/Sparte, Perse) | ~18 |
| 4 | Rome, Chine des Han, Inde des Gupta | ~18 |
| 5 | Christianisation de l'Occident, islamisation de l'Orient | ~18 |
| 6 | Essor urbain et commercial au Moyen Âge | ~18 |

Basis: Secondary 1 has 6 history/geography periods per 9-day cycle, 180 school days/year → ~120
theoretical classes, ~110 realistic after exams/assemblies. Target pace: students acquire roughly
1–2 tree-unlock cards per class (validated by a spreadsheet pacing simulator: at ~5.5 pts/category/
class, both Era-1 trees complete around class 19–20, matching the chapter's class budget).

## What still needs building (the actual Claude Code work)
In rough priority order as the source conversation left it:
1. **Digital tracker/dashboard** ("tableau de bord" / feuille de tour) — the single biggest missing
   piece. Needs to support multiple independent, concurrent class "games," per-team views (resources,
   cards in play, units, settlements/districts/buildings, discovered-card library) and a teacher
   admin view for crediting points (quiz, workbook, i+, test, reading — all manual-credit buttons)
   and adjudicating events. Needs both a "projected on smartboard, teacher-driven" mode and an
   "individual student device" mode.
2. **Quiz du jour engine** — question bank tagged by chapter/era + resource category
   (Science/Culture/Food/Production/Cash), auto-scored digitally with credited points flowing
   straight into the tracker, plus a printable fallback (PDF, matching the card aesthetic) with an
   answer key for no-device days, bulk-creditable afterward.
3. **Card content pipeline** — port/rebuild the spreadsheet-of-truth + batch PDF generator pattern
   (see physical card spec above) so Aiden can keep editing content in a spreadsheet-like UI and
   regenerate print sheets on demand, including the 9-per-page 63×88mm sleeve-ready layout.
4. **Hex map** — regional sub-maps for each starting cradle + a world map that only reveals
   civilizations past a size/era threshold; needs a way to render/print a paper version and ideally
   a digital view too.
5. **Pacing/balance simulator** — carry forward the "given a points/class rate, when does each tree
   node unlock" model so every future era's economy can be sanity-checked before it ever reaches a
   classroom.
6. Remaining eras (2 through 6+) need the same full treatment Era 1 got: tech tree, civic tree,
   units, districts/buildings, historical event cards (each tagged with its PDA link), territoire
   cards, grands personnages — all sourced from the official Quebec PDA/Alloprof/reputable
   references, in French, following the established card schema.

## Pedagogical / historical-accuracy guardrails (explicitly agreed in the source conversation)
- All historical descriptions must come from credible, citable sources (Alloprof, the official
  Quebec PDA curriculum documents for Secondary 1–5, encyclopedias, books/articles) — not invented
  or hallucinated flavor text.
- Avoid a Eurocentric/teleological "one path of progress" framing; the game should not imply all
  societies advance identically toward the same endpoint.
- Politically/religiously loaded later-era content (monotheisms, 20th-century ideologies like
  fascism/communism/liberal democracy) should be treated the way a neutral history textbook would —
  factual and descriptive, with no in-game mechanic implying one option is objectively "better."
- Indigenous content (*territoire autochtone* specifically) must reflect its real contemporary PDA
  framing (Northern nations, real treaties) and must not be mechanically conflated with prehistoric/
  "primitive" peoples — see the flag under Cartes territoire above.
- Avoid inappropriate imagery (a specific real cave-art image with nudity was already rejected for
  classroom use as an example of the bar to apply).

## Environment note
This machine didn't have `poppler-utils` installed, which the PDF-reading tool depends on for
multi-page PDFs (`pdftoppm`/`pdftotext`) — every multi-page PDF failed until it was installed via
`winget install oschwartz10612.Poppler`. If a fresh Claude Code session still hits a
"pdftoppm is not installed" error, either restart the session (the winget install already happened,
it just needs a fresh process to pick up the PATH change) or, as a same-session workaround, call the
binaries directly by their absolute path — they land under
`%LOCALAPPDATA%\Microsoft\WinGet\Packages\oschwartz10612.Poppler_*\poppler-*\Library\bin\`.

## Immediate next step for Claude Code
Given all of the above was already validated by Aiden in the source conversation, the highest-value
first move is almost certainly to scope and start the **digital tracker/dashboard**, since it's the
piece that unblocks running a real pilot — everything else (cards, map, quiz bank) already has a
working content-production pattern from the prior chat. Confirm with Aiden: tech stack preference
(this being Claude Code rather than artifacts means it's no longer limited to what a claude.ai
artifact can do — worth deciding whether this becomes a real local/web app, and how it should be
hosted/accessed by students), whether the missing Claude Design dashboard prototype should be
retrieved first, and whether to import the existing `banque_cartes.xlsx`/card-generator work if
Aiden still has those files, rather than rebuilding them from zero.
