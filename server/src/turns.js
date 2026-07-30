// Approximate year + epoch shown on the dashboard, tied to turn number.
// Turns 1-8 use the fixed dates behind the scripted event sequence; turns 9-20
// interpolate toward -3300 (Écriture), the bridge into Chapter 2 (Mésopotamie).
const SCRIPTED_YEARS = {
  1: -48000, // Glaciation
  2: -45000, // Passage d'un troupeau
  3: -42000, // Rencontre de Homo neanderthalensis (chevauchement Néandertal/Sapiens en Europe)
  4: -39000, // Second contact néandertalien
  5: -12000, // Réchauffement climatique (transition Pléistocène/Holocène)
  6: -11000, // Découverte d'obsidienne
  7: -10500, // Propriété
  8: -10000, // Hiérarchie sociale (aligne avec la carte Agriculture, -10 000)
};
const CHAPTER_END_TURN = 20;
const CHAPTER_END_YEAR = -3300; // Écriture

export function yearForTurn(turn) {
  if (turn <= 1) return SCRIPTED_YEARS[1];
  if (SCRIPTED_YEARS[turn]) return SCRIPTED_YEARS[turn];
  if (turn <= 8) return SCRIPTED_YEARS[8];
  if (turn >= CHAPTER_END_TURN) return CHAPTER_END_YEAR;
  const t = (turn - 8) / (CHAPTER_END_TURN - 8);
  return Math.round(SCRIPTED_YEARS[8] + t * (CHAPTER_END_YEAR - SCRIPTED_YEARS[8]));
}

export function epochForYear(year) {
  if (year <= -10000) return "Paléolithique";
  if (year <= -3300) return "Néolithique";
  return "Antiquité (aube de l'écriture)";
}

export function formatYear(year) {
  return year < 0
    ? `environ ${Math.abs(year).toLocaleString("fr-CA")} av. J.-C.`
    : `environ ${year} apr. J.-C.`;
}
