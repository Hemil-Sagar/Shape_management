import { Parser } from "expr-eval-fork";

export const CONCRETE_GRADE_VALUES = { M20: 20, M25: 25, M30: 30, M35: 35, M40: 40 };

export const STEEL_GRADE_VALUES = { Fe415: 415, Fe500: 500 };

const LD_MULTIPLIER = {
  "M20|Fe415": 47, "M20|Fe500": 50,
  "M25|Fe415": 44, "M25|Fe500": 47,
  "M30|Fe415": 40, "M30|Fe500": 44,
  "M35|Fe415": 38, "M35|Fe500": 42,
  "M40|Fe415": 36, "M40|Fe500": 40,
};

export function parseBarDia(barDia) {
  const match = /(\d+)-T(\d+)/.exec(barDia || "");
  if (!match) return { bar: 0, dia: 0 };
  return { bar: Number(match[1]), dia: Number(match[2]) };
}

export function calculateLd(gradeOfConcrete, gradeOfSteel, dia) {
  const multiplier = LD_MULTIPLIER[`${gradeOfConcrete}|${gradeOfSteel}`] ?? 45;
  return multiplier * dia;
}

const parser = new Parser();

/** Evaluates each output formula against variables. Case-insensitive-safe: variables must match formula tokens exactly (mirrors simpleeval behavior). */
export function calculateShapeOutputs(shape, variables) {
  const outputs = [];

  for (const output of shape.outputs || []) {
    const formula = output.formula;
    const base = {
      output_name: output.output_name,
      unit: output.unit || "m",
      formula_used: formula,
      formula_source: output.formula_source || "global",
    };

    try {
      const expr = parser.parse(formula);
      // expr-eval already provides max()/min() as built-in functions
      const valueInMm = expr.evaluate(variables);
      const valueInMeter = valueInMm / 1000;
      outputs.push({ ...base, value: Math.round(valueInMeter * 1000) / 1000 });
    } catch (error) {
      outputs.push({ ...base, value: null, error: String(error.message || error) });
    }
  }

  return outputs;
}
