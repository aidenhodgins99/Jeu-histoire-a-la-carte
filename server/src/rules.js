// Turns the free-text "prerequisite" / "unlocked by" columns from the CSVs into
// actual unlock checks against a civilization's owned cards. The CSVs are written
// for human teachers ("Agriculture", "Navigation marine ou Travail du bois"), so
// this does light OR/AND parsing over card titles rather than requiring Aiden to
// maintain separate machine-readable ids.
import { loadContent, slugify } from "./content.js";

function titleIndex() {
  const content = loadContent();
  const map = new Map();
  for (const c of [...content.scienceCards, ...content.cultureCards]) {
    map.set(slugify(c.title), c.id);
  }
  return map;
}

let cachedTitleIndex = null;
function getTitleIndex() {
  if (!cachedTitleIndex) cachedTitleIndex = titleIndex();
  return cachedTitleIndex;
}

// "Agriculture", "Navigation marine ou Travail du bois", "Cuisine, Outils de pierre et d'os"
// -> true if the owned set satisfies at least one OR-branch of AND-requirements.
export function isRequirementSatisfied(requirementText, ownedCardIds) {
  const text = (requirementText || "").trim();
  if (!text || /départ/i.test(text) || text === "Aucun") return true;
  if (/^À déterminer/i.test(text)) return false; // future-era placeholder, never satisfiable yet

  const owned = new Set(ownedCardIds);
  const idx = getTitleIndex();

  function matchesSingleCard(str) {
    const slug = slugify(str.replace(/\(science\)|\(culture\)/gi, "").trim());
    const cardId = idx.get(slug);
    return cardId ? owned.has(cardId) : null; // null = not a recognized single title
  }

  // Titles themselves often contain " et " (e.g. "Outils de pierre et d'os"), so an
  // OR/AND branch is only decomposed further if it doesn't match a known title whole.
  const orBranches = text.split(/\bou\b/i).map((s) => s.trim());
  return orBranches.some((branch) => {
    const whole = matchesSingleCard(branch);
    if (whole !== null) return whole;

    const andParts = branch.split(/,|;/).map((s) => s.trim()).filter(Boolean);
    if (andParts.length === 0) return false;
    return andParts.every((part) => matchesSingleCard(part) === true);
  });
}

export function unlockedContent(ownedCardIds) {
  const content = loadContent();
  const owned = new Set(ownedCardIds);

  const discoverableCards = [...content.scienceCards, ...content.cultureCards].filter(
    (c) => !owned.has(c.id) && c.prerequisites.every((p) => isRequirementSatisfied(p, owned))
  );

  const unlockedUnits = content.units.filter((u) => isRequirementSatisfied(u.unlockedBy, owned));
  const unlockedDistricts = content.districts.filter((d) => isRequirementSatisfied(d.unlockedBy, owned));

  return { discoverableCards, unlockedUnits, unlockedDistricts };
}

// Anti-accumulation cost curve for repeatable units (2nd copy onward): 4, 6, 9, 13, 18...
// (+2, +3, +4, +5 step growth) matching the "3e=4, 4e=6, 5e=9" example in the CSV notes.
export function unitCopyCost(unit, copiesAlreadyOwned) {
  if (copiesAlreadyOwned === 0) return unit.costFirst ?? 0;
  const sequence = [4, 6, 9, 13, 18, 24, 31];
  const step = Math.min(copiesAlreadyOwned - 1, sequence.length - 1);
  return sequence[step];
}
