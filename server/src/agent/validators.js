import { findProjectByName, findShapeByName, getCurrentFormula, getShapeOutputNames } from "./tools.js";
import { findUnknownAbbreviationsInFormula, getValidAbbreviationList } from "../utils/abbreviationTool.js";
import { resolveShapeForProject } from "../services/shapeResolver.js";

/**
 * Port of agent/validators.py::validate_formula_update_request.
 * Runs, in order: missing-fields check, unknown-abbreviation check,
 * project lookup, shape lookup, project-scoped shape resolution,
 * output/current-formula lookup. Returns { isValid, missingFields, error, resolvedData }.
 */
export async function validateFormulaUpdateRequest(userEmail, data) {
  const missingFields = [];

  const projectName = data.project_name;
  const category = data.category || "beam";
  const shapeName = data.shape_name;
  const outputName = data.output_name;
  const requestedFormula = data.requested_formula;
  const reason = data.reason;

  if (!projectName) missingFields.push("project_name");
  if (!shapeName) missingFields.push("shape_name");
  if (!outputName) missingFields.push("output_name");
  if (!requestedFormula) missingFields.push("requested_formula");
  if (!reason) missingFields.push("reason");

  if (missingFields.length > 0) {
    return {
      isValid: false,
      missingFields,
      error: null,
      resolvedData: data,
    };
  }

  const unknownAbbreviations = findUnknownAbbreviationsInFormula(requestedFormula);

  if (unknownAbbreviations.length > 0) {
    const validAbbreviations = getValidAbbreviationList().join(", ");

    return {
      isValid: false,
      missingFields: [],
      error:
        `The requested formula contains unknown abbreviation(s): ` +
        `${unknownAbbreviations.join(", ")}. ` +
        `Please correct them. Valid abbreviations are: ${validAbbreviations}.`,
      resolvedData: data,
    };
  }

  // 1. Find project
  const project = await findProjectByName(userEmail, projectName);

  if (!project) {
    return {
      isValid: false,
      missingFields: [],
      error: `Project '${projectName}' was not found for this user.`,
      resolvedData: data,
    };
  }

  // 2. Find global/base shape
  const shape = await findShapeByName(category, shapeName);

  if (!shape) {
    return {
      isValid: false,
      missingFields: [],
      error: `Shape '${shapeName}' was not found in category '${category}'.`,
      resolvedData: data,
    };
  }

  // 3. Resolve shape for this specific project.
  // This checks the custom shape library first.
  // If the project has a custom formula override, current_formula comes from there.
  // Otherwise it comes from the global shape_library entry.
  const resolvedShape = await resolveShapeForProject(String(project._id), null, String(shape._id));

  if (!resolvedShape) {
    return {
      isValid: false,
      missingFields: [],
      error: "Could not resolve shape formula for this project.",
      resolvedData: data,
    };
  }

  const currentFormula = getCurrentFormula(resolvedShape, outputName);

  if (!currentFormula) {
    const outputNames = getShapeOutputNames(resolvedShape);

    return {
      isValid: false,
      missingFields: [],
      error: `Output '${outputName}' was not found. Available outputs: ${outputNames.join(", ")}`,
      resolvedData: data,
    };
  }

  const resolvedData = {
    ...data,
    project_id: String(project._id),
    project_name: project.project_name,

    shape_id: String(shape._id),
    shape_name: shape.shape_name,

    category: shape.category,
    output_name: outputName,
    current_formula: currentFormula,
  };

  return {
    isValid: true,
    missingFields: [],
    error: null,
    resolvedData,
  };
}
