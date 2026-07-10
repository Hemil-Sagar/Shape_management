export const ABBREVIATION_DICTIONARY = {
  BX: "Beam in X",
  BY: "Beam in Y",
  BZ: "Beam in Z",

  CX: "Column in X (Left)",
  CY: "Column in X (Right)",
  CZ: "Column in X (Middle)",

  B2X: "Beam no.2 in X",
  B2Y: "Beam no.2 in Y",
  B2Z: "Beam no.2 in Z",

  C2X: "Column no.2 in X (Left)",
  C2Y: "Column no.2 in X (Right)",
  C2Z: "Column no.2 in X (Middle)",

  CO: "Cover",
  BR: "Bar",
  D: "Dia",

  GC: "Grade of Concrete",
  GS: "Grade of Steel",

  SS: "Spacing of Stirrups",
  SD: "Stirrups Dia",
  LS: "Leg of Stirrups",

  LD: "GC/GS",
  BN: "Bend Numbers",
  BD: "Bend Deduction",
};

export const MATH_FUNCTIONS = new Set(["MIN", "MAX", "ROUND", "ABS", "SQRT", "POW"]);

export function getAbbreviationMeaning(shortName) {
  if (!shortName) return null;
  return ABBREVIATION_DICTIONARY[shortName.trim().toUpperCase()] ?? null;
}

export function extractFormulaTokens(formula) {
  if (!formula) return [];
  return formula.toUpperCase().match(/\b[A-Z][A-Z0-9]*\b/g) ?? [];
}

export function extractAbbreviationsFromFormula(formula) {
  const tokens = extractFormulaTokens(formula);
  const result = [];
  const alreadyAdded = new Set();

  for (const token of tokens) {
    if (MATH_FUNCTIONS.has(token)) continue;
    if (token in ABBREVIATION_DICTIONARY && !alreadyAdded.has(token)) {
      result.push({ short_name: token, full_form: ABBREVIATION_DICTIONARY[token] });
      alreadyAdded.add(token);
    }
  }

  return result;
}

export function findUnknownAbbreviationsInFormula(formula) {
  const tokens = extractFormulaTokens(formula);
  const unknownTerms = [];
  const alreadyAdded = new Set();

  for (const token of tokens) {
    if (MATH_FUNCTIONS.has(token)) continue;
    if (!(token in ABBREVIATION_DICTIONARY) && !alreadyAdded.has(token)) {
      unknownTerms.push(token);
      alreadyAdded.add(token);
    }
  }

  return unknownTerms;
}

export function getValidAbbreviationList() {
  return Object.keys(ABBREVIATION_DICTIONARY).sort();
}
