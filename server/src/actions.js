// Unit ("citizen") actions available per unit type. Some actions produce
// resources; some mutate the tile itself (visible on the map), like an
// Agriculteur turning a Territoire forestier into a Territoire agricole.
import { httpError } from "./civ.js";
import { neighborsOf } from "./map.js";

const HUNT_TILES = new Set(["territoire_forestier", "territoire_de_plaine", "territoire_de_toundra"]);
const GATHER_TILES = new Set(["territoire_forestier", "territoire_de_plaine"]);
const CULTIVABLE_TILES = new Set(["territoire_forestier", "territoire_de_plaine"]);

function requireOwned(civ, cardId, label) {
  if (!civ.ownedCards.includes(cardId)) throw httpError(400, `${label} n'est pas encore découvert(e).`);
}

const ACTION_DEFS = {
  chasseur_cueilleur: {
    chasse: {
      label: "Chasse",
      run(civ, tile) {
        if (!HUNT_TILES.has(tile.terrainId)) {
          throw httpError(400, "La chasse n'est possible que sur une tuile de forêt, de plaine ou de toundra.");
        }
        return { resources: { ...civ.resources, nourriture: civ.resources.nourriture + 2 } };
      },
    },
    cueillir: {
      label: "Cueillir",
      run(civ, tile) {
        if (!GATHER_TILES.has(tile.terrainId)) {
          throw httpError(400, "La cueillette n'est possible que sur une tuile de forêt ou de plaine.");
        }
        return { resources: { ...civ.resources, nourriture: civ.resources.nourriture + 1 } };
      },
    },
    tannage: {
      label: "Tannage (construire un site de tannage)",
      run(civ, tile) {
        requireOwned(civ, "vetements_cuir", "Vêtements de cuir");
        if (tile.hasTanningSite) throw httpError(400, "Un site de tannage existe déjà sur cette tuile.");
        return {
          resources: { ...civ.resources, production: civ.resources.production + 2 },
          tilePatch: { hasTanningSite: true },
        };
      },
    },
  },
  agriculteur: {
    cultiver: {
      label: "Cultiver (transformer en Territoire agricole)",
      run(civ, tile) {
        requireOwned(civ, "agriculture", "Agriculture");
        if (!CULTIVABLE_TILES.has(tile.terrainId)) {
          throw httpError(400, "Seules les tuiles de forêt ou de plaine peuvent être cultivées.");
        }
        return { tilePatch: { terrainId: "territoire_agricole" } };
      },
    },
  },
};

const MOVE_ACTION = "se_deplacer";

export function availableActions(unitType) {
  const defs = ACTION_DEFS[unitType] || {};
  const list = Object.entries(defs).map(([key, def]) => ({ key, label: def.label }));
  list.push({ key: MOVE_ACTION, label: "Se déplacer" });
  return list;
}

export function runUnitAction({ civ, tileIndex, unitId, actionKey, targetIndex }) {
  const tile = civ.map[tileIndex];
  if (!tile) throw httpError(404, "Tuile introuvable.");
  const unit = tile.units.find((u) => u.id === unitId);
  if (!unit) throw httpError(404, "Unité introuvable sur cette tuile.");

  if (actionKey === MOVE_ACTION) {
    if (targetIndex == null || !civ.map[targetIndex]) throw httpError(400, "Destination invalide.");
    if (!neighborsOf(Number(tileIndex)).includes(Number(targetIndex))) {
      throw httpError(400, "Une unité ne peut se déplacer que vers une tuile adjacente.");
    }
    const newMap = civ.map.map((t, i) => {
      if (i === Number(tileIndex)) return { ...t, units: t.units.filter((u) => u.id !== unitId) };
      if (i === Number(targetIndex)) return { ...t, units: [...t.units, unit] };
      return t;
    });
    return { map: newMap, resources: civ.resources };
  }

  const def = (ACTION_DEFS[unit.type] || {})[actionKey];
  if (!def) throw httpError(400, "Action invalide pour cette unité.");
  const result = def.run(civ, tile);

  const newMap = civ.map.map((t, i) =>
    i === Number(tileIndex) && result.tilePatch ? { ...t, ...result.tilePatch } : t
  );
  return { map: newMap, resources: result.resources || civ.resources };
}
