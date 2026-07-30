// The 3x3 map mirrors the physical 9-pocket card-sleeve page: index 0-8,
// left-to-right then top-to-bottom, center (index 4) is tile 5 of the sleeve.
// Starting layout is a small Croissant-fertile-style spread of biomes around
// a central Territoire forestier, per the design brief.
export const CENTER_INDEX = 4;

const STARTING_LAYOUT = [
  "territoire_de_plaine",
  "territoire_de_toundra",
  "territoire_cotier_ou_fluvial",
  "territoire_de_plaine",
  "territoire_forestier",
  "territoire_de_plaine",
  "territoire_montagneux",
  "territoire_de_plaine",
  "territoire_de_toundra",
];

export function generateStartingMap({ starterUnitId }) {
  return STARTING_LAYOUT.map((terrainId, index) => ({
    index,
    terrainId,
    units: index === CENTER_INDEX ? [{ id: `u${Date.now()}`, type: starterUnitId }] : [],
  }));
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
