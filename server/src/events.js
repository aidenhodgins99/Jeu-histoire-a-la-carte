// Scripted historical-event sequence for turns 1-8, per Aiden's specified order.
// Each event is grounded in Cartes_Historiques_Era1.csv where a matching row
// exists; turn 4 (the second Neanderthal encounter / war-or-peace branch) is new
// content authored to extend that file's turn-by-turn narrative.
//
// Descriptions are written as history for students to read, not as design
// notes — the CSV's "Effet" column is a mechanical note for building the game
// (see Cartes_Historiques_Era1.csv) and must never be surfaced as-is; the
// "Lien_PDA" column is what actually carries grounded historical context.
//
// Judgment events (turn 3, turn 7) deliberately carry no automatic effect:
// the student writes a real decision, and Aiden reads it and assigns a bonus
// or penalty afterward through the teacher dashboard — not a formula.
import { loadContent } from "./content.js";

function findEvent(titleContains) {
  const { historicalEvents } = loadContent();
  const match = historicalEvents.find((e) => e.title.toLowerCase().includes(titleContains.toLowerCase()));
  if (!match) throw new Error(`Carte historique introuvable pour "${titleContains}" — vérifier Cartes_Historiques_Era1.csv`);
  return match;
}

// scriptedEventForTurn is called independently by both the "display" endpoint
// (GET /me/turn, showing the event before confirmation) and the "apply"
// endpoint (POST /turn/advance). Anything randomized inside it must be seeded
// deterministically from civId+turn, not Math.random(), or the two calls can
// disagree — e.g. the description naming one animal while a different one
// gets spawned on the map.
function seededPick(list, seed) {
  const hash = String(seed).split("").reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return list[hash % list.length];
}

export function scriptedEventForTurn(turn, civId) {
  switch (turn) {
    case 1: {
      const e = findEvent("Glaciation");
      return {
        id: "turn1_glaciation",
        turn,
        title: e.title,
        description:
          "Le climat se refroidit brutalement. Les glaciers avancent, le gibier se fait plus rare, et ton clan doit sans cesse s'adapter aux caprices du climat pour survivre.",
        requiresText: false,
        effect: { resourceDelta: { nourriture: -1 } },
      };
    }
    case 2: {
      const e = findEvent("Passage d'un troupeau");
      const fauna = loadContent().mapResources.filter((r) => r.kind === "faune");
      const chosen = seededPick(fauna, `${civId}-${turn}`);
      return {
        id: "turn2_troupeau",
        turn,
        title: e.title,
        description: `Un troupeau de ${chosen.title.toLowerCase()} traverse votre territoire et apparaît sur la carte — chasse-le avant qu'il ne reparte !`,
        requiresText: false,
        spawnsFauna: chosen.id,
        effect: { resourceDelta: {} },
      };
    }
    case 3: {
      const e = findEvent("Rencontre de Homo neanderthalensis");
      return {
        id: "turn3_neandertal",
        turn,
        title: e.title,
        description:
          "Ton clan croise un groupe de Homo neanderthalensis — une autre espèce humaine qui vit alors aux côtés de la tienne. Les sociétés du Paléolithique ne sont pas uniformes : plusieurs groupes humains coexistent, parfois dans une même région.",
        requiresText: true,
        textPrompt: "Comment ton clan réagit-il à cette première rencontre avec un autre groupe humain ? Explique votre décision.",
        effect: { resourceDelta: {} },
      };
    }
    case 4:
      return {
        id: "turn4_neandertal_choix",
        turn,
        title: "Un second contact avec les Néandertaliens",
        description:
          "Votre groupe croise à nouveau une bande de Néandertaliens. L'ADN des humains actuels montre que les deux groupes se sont parfois mélangés et parfois affrontés, selon les régions et les époques — les deux issues sont attestées.",
        requiresText: false,
        choice: {
          prompt: "Comment votre civilisation choisit-elle d'agir ?",
          options: [
            {
              key: "guerre",
              label: "Le conflit — repousser les Néandertaliens hors de votre territoire",
              effect: { resourceDelta: { production: 2 }, bonheurDelta: -1 },
            },
            {
              key: "paix",
              label: "L'échange — coexister et échanger des techniques",
              effect: { resourceDelta: { culture: 2, science: 1 }, bonheurDelta: 1 },
            },
          ],
        },
      };
    case 5: {
      const e = findEvent("Réchauffement climatique");
      return {
        id: "turn5_rechauffement",
        turn,
        title: e.title,
        description:
          "Le climat de la Terre se réchauffe. Le gibier, le poisson et les graminées sauvages deviennent plus abondants — nul besoin de nomadiser sans cesse pour trouver de quoi se nourrir.",
        requiresText: false,
        effect: { resourceDelta: { nourriture: 2 } },
      };
    }
    case 6: {
      const e = findEvent("obsidienne");
      return {
        id: "turn6_obsidienne",
        turn,
        title: e.title,
        description:
          "En explorant un relief montagneux, ton clan découvre un gisement d'obsidienne — une roche volcanique très tranchante, prisée pour fabriquer outils et armes.",
        requiresText: false,
        effect: { resourceDelta: { production: 2 } },
      };
    }
    case 7: {
      const e = findEvent("Propriété");
      return {
        id: "turn7_propriete",
        turn,
        title: e.title,
        description:
          "Ta civilisation améliore un premier lopin de terre — un champ, un pâturage, une mine. Une question nouvelle se pose alors à ton clan : à qui appartient cette terre, et ce qu'elle produit ?",
        requiresText: true,
        textPrompt: "À qui appartient la terre que ta civilisation cultive, selon toi ? Explique ta réponse.",
        effect: { resourceDelta: {} },
      };
    }
    case 8: {
      const e = findEvent("Hiérarchie sociale");
      return {
        id: "turn8_hierarchie",
        turn,
        title: e.title,
        description:
          "Dans certains villages néolithiques, comme à Varna, en Bulgarie, on retrouve des sépultures accompagnées d'objets précieux — un signe qu'une hiérarchie sociale commence à apparaître entre les membres de la communauté.",
        requiresText: true,
        textPrompt:
          "Une hiérarchie sociale commence à apparaître. Qu'en penses-tu pour ta propre civilisation ?",
        effect: { resourceDelta: {} },
      };
    }
    default:
      return null; // au-delà du tour 8 : pas encore scénarisé
  }
}
