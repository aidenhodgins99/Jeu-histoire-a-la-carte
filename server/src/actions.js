// Unit ("citizen") actions available per unit type. Some actions produce
// resources; some mutate the tile itself (visible on the map), like an
// Agriculteur turning a Territoire forestier into a Territoire agricole.
import { httpError } from "./civ.js";
import { neighborsOf } from "./map.js";

const HUNT_TILES = new Set(["territoire_forestier", "territoire_de_plaine", "territoire_de_toundra"]);
const GATHER_TILES = new Set(["territoire_forestier", "territoire_de_plaine"]);
const CULTIVABLE_TILES = new Set(["territoire_forestier", "territoire_de_plaine"]);

// Each action declares isAvailable(civ, tile) so the client only ever sees
// buttons it can actually use — e.g. Tannage shouldn't appear until Vêtements
// de cuir is discovered, rather than appearing and failing on click.
const ACTION_DEFS = {
  chasseur_cueilleur: {
    chasse: {
      label: "Chasse",
      isAvailable: (civ, tile) => HUNT_TILES.has(tile.terrainId),
      unavailableMessage: "La chasse n'est possible que sur une tuile de forêt, de plaine ou de toundra.",
      run(civ) {
        return { resources: { ...civ.resources, nourriture: civ.resources.nourriture + 2 } };
      },
    },
    cueillir: {
      label: "Cueillir",
      isAvailable: (civ, tile) => GATHER_TILES.has(tile.terrainId),
      unavailableMessage: "La cueillette n'est possible que sur une tuile de forêt ou de plaine.",
      run(civ) {
        return { resources: { ...civ.resources, nourriture: civ.resources.nourriture + 1 } };
      },
    },
    tannage: {
      label: "Tannage (construire un site de tannage)",
      isAvailable: (civ, tile) => civ.ownedCards.includes("vetements_cuir") && !tile.hasTanningSite,
      unavailableMessage: "Il faut d'abord découvrir Vêtements de cuir.",
      run(civ) {
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
      isAvailable: (civ, tile) => civ.ownedCards.includes("agriculture") && CULTIVABLE_TILES.has(tile.terrainId),
      unavailableMessage: "Il faut d'abord découvrir Agriculture ; possible seulement sur forêt ou plaine.",
      run() {
        return { tilePatch: { terrainId: "territoire_agricole" } };
      },
    },
  },
};

const MOVE_ACTION = "se_deplacer";

export function availableActions(civ, unitType, tile) {
  const defs = ACTION_DEFS[unitType] || {};
  const list = Object.entries(defs)
    .filter(([, def]) => def.isAvailable(civ, tile))
    .map(([key, def]) => ({ key, label: def.label }));
  list.push({ key: MOVE_ACTION, label: "Se déplacer" });
  return list;
}

export function runUnitAction({ civ, tileIndex, unitId, actionKey, targetIndex }) {
  const tile = civ.map[tileIndex];
  if (!tile) throw httpError(404, "Tuile introuvable.");
  const unit = tile.units.find((u) => u.id === unitId);
  if (!unit) throw httpError(404, "Citoyen introuvable sur cette tuile.");
  if ((civ.turnState.actedUnitIds || []).includes(unitId)) {
    throw httpError(400, "Ce citoyen a déjà agi ce tour-ci.");
  }

  if (actionKey === MOVE_ACTION) {
    if (targetIndex == null || !civ.map[targetIndex]) throw httpError(400, "Destination invalide.");
    if (!neighborsOf(Number(tileIndex)).includes(Number(targetIndex))) {
      throw httpError(400, "Un citoyen ne peut se déplacer que vers une tuile adjacente.");
    }
    const newMap = civ.map.map((t, i) => {
      if (i === Number(tileIndex)) return { ...t, units: t.units.filter((u) => u.id !== unitId) };
      if (i === Number(targetIndex)) return { ...t, units: [...t.units, unit] };
      return t;
    });
    return { map: newMap, resources: civ.resources, actedUnitId: unitId };
  }

  const def = (ACTION_DEFS[unit.type] || {})[actionKey];
  if (!def) throw httpError(400, "Action invalide pour ce citoyen.");
  if (!def.isAvailable(civ, tile)) throw httpError(400, def.unavailableMessage || "Action indisponible pour le moment.");
  const result = def.run(civ, tile);

  const newMap = civ.map.map((t, i) =>
    i === Number(tileIndex) && result.tilePatch ? { ...t, ...result.tilePatch } : t
  );
  return { map: newMap, resources: result.resources || civ.resources, actedUnitId: unitId };
}
