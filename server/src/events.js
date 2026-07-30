// Scripted historical-event sequence for turns 1-8, per Aiden's specified order.
// Each event is grounded in Cartes_Historiques_Era1.csv where a matching row
// exists; turn 4 (the second Neanderthal encounter / war-or-peace branch) is new
// content authored to extend that file's turn-by-turn narrative.
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
        description: e.effect,
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
        description: e.effect,
        requiresText: true,
        textPrompt: "Comment ton clan réagit-il à cette première rencontre avec un autre groupe humain ?",
        effect: { resourceDelta: { science: 1 } },
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
        description: e.effect,
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
        description: e.effect,
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
        description: e.effect,
        requiresText: true,
        textPrompt: "À qui appartient la terre que ta civilisation cultive, selon toi ? Explique ta réponse.",
        effect: { resourceDelta: { culture: 1 } },
      };
    }
    case 8: {
      const e = findEvent("Hiérarchie sociale");
      return {
        id: "turn8_hierarchie",
        turn,
        title: e.title,
        description: e.effect,
        requiresText: true,
        textPrompt:
          "Une hiérarchie sociale commence à apparaître dans certains villages néolithiques (voir l'exemple de Varna, en Bulgarie). Qu'en penses-tu pour ta propre civilisation ?",
        effect: { resourceDelta: {} },
      };
    }
    default:
      return null; // au-delà du tour 8 : pas encore scénarisé
  }
}
