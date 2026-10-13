// Rule-based duplicate check (NOT AI): flags two medicines that look like the
// same active ingredient or the same name. It never diagnoses or advises; the
// app only suggests checking with a pharmacist.

import type { Medication } from "./types";

// Common brand names (and Chinese names) mapped to their active ingredient.
// Extend this list as needed.
const KNOWN_INGREDIENTS: Record<string, string> = {
  paracetamol: "paracetamol",
  acetaminophen: "paracetamol",
  panadol: "paracetamol",
  tylenol: "paracetamol",
  撲熱息痛: "paracetamol",
  必理痛: "paracetamol",
  aspirin: "aspirin",
  cardiprin: "aspirin",
  bayaspirin: "aspirin",
  阿士匹靈: "aspirin",
  阿司匹林: "aspirin",
  ibuprofen: "ibuprofen",
  brufen: "ibuprofen",
  nurofen: "ibuprofen",
  advil: "ibuprofen",
  布洛芬: "ibuprofen",
  metformin: "metformin",
  glucophage: "metformin",
  二甲雙胍: "metformin",
  amlodipine: "amlodipine",
  norvasc: "amlodipine",
  氨氯地平: "amlodipine",
  atorvastatin: "atorvastatin",
  lipitor: "atorvastatin",
  simvastatin: "simvastatin",
  zocor: "simvastatin",
};

// Words in a medicine name that are not ingredients.
const IGNORE = new Set([
  "low", "high", "dose", "tablet", "tablets", "capsule", "capsules", "extended", "release",
  "slow", "for", "pain", "relief", "the", "and", "with", "daily", "oral", "solution", "syrup",
  "cream", "mg", "mcg", "film", "coated", "plus", "forte", "strength",
]);

export function ingredientsOf(name: string): Set<string> {
  const lower = name.toLowerCase();
  const found = new Set<string>();

  // Chinese names have no spaces, so look for known names inside the text.
  for (const [term, ingredient] of Object.entries(KNOWN_INGREDIENTS)) {
    if (/[一-鿿]/.test(term) && lower.includes(term)) found.add(ingredient);
  }
  // English words: brand -> ingredient, otherwise the word itself.
  for (const word of lower.split(/[^a-z]+/)) {
    if (word.length < 4 || IGNORE.has(word)) continue;
    found.add(KNOWN_INGREDIENTS[word] ?? word);
  }
  return found;
}

export type DuplicatePair = { a: Medication; b: Medication };

// Pairs of active medicines that may be the same medicine.
export function findDuplicates(meds: Medication[]): DuplicatePair[] {
  const active = meds.filter((m) => m.active);
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = ingredientsOf(active[i].name);
      const b = ingredientsOf(active[j].name);
      const sameName = active[i].name.trim().toLowerCase() === active[j].name.trim().toLowerCase();
      if (sameName || [...a].some((x) => b.has(x))) pairs.push({ a: active[i], b: active[j] });
    }
  }
  return pairs;
}
