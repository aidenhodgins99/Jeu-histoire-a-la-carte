// The 3x3 map mirrors the physical 9-pocket card-sleeve page: index 0-8,
// left-to-right then top-to-bottom, center (index 4) is tile 5 of the sleeve.
// Starting layout follows a plausible geography rather than a random spread:
// mountains (upland source region) along the top with toundra between them,
// a river running south from the mountains past the forest, plains filling
// the lowlands, and the coast at the southern edge where the river would
// plausibly reach the sea — deliberately not placed in the middle of the map.
export const CENTER_INDEX = 4;

const STARTING_LAYOUT = [
  "territoire_montagneux",
  "territoire_de_toundra",
  "territoire_montagneux",
  "territoire_fluvial",
  "territoire_forestier",
  "territoire_de_plaine",
  "territoire_de_plaine",
  "territoire_cotier",
  "territoire_de_plaine",
];

// Static map resources (Pierre, Épices) are placed once at map generation on
// the first eligible non-center tile — deterministic so the layout stays
// legible, not scattered randomly. Fauna resources are spawned later by
// historical events (see routes/civ.js turn/advance).
export function generateStartingMap({ starterUnitId, staticResources = [] }) {
  const tiles = STARTING_LAYOUT.map((terrainId, index) => ({
    index,
    terrainId,
    units: index === CENTER_INDEX ? [{ id: `u${Date.now()}`, type: starterUnitId }] : [],
    resource: null,
  }));
  for (const res of staticResources) {
    const tile = tiles.find((t) => !t.resource && t.index !== CENTER_INDEX && res.compatibleTerrain.includes(t.terrainId));
    if (tile) tile.resource = { id: res.id, kind: res.kind };
  }
  return tiles;
}

export function neighborsOf(index) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const out = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < 3 && c >= 0 && c < 3) out.push(r * 3 + c);
  }
  return out;
}
