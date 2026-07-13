import {
  shapeLibraryCollection,
  customShapeLibraryCollection,
  projectsCollection,
  toObjectId,
} from "../db/index.js";

async function getProjectOwnerEmail(projectId) {
  if (!projectId) return null;
  const oid = toObjectId(projectId);
  if (!oid) return null;
  const project = await projectsCollection.findOne({ _id: oid });
  return project?.created_by ?? null;
}

function customShapeScopeFilter(projectId, ownerEmail) {
  const scopes = [{ project_id: projectId }];
  if (ownerEmail) scopes.push({ user_email: ownerEmail });
  return { $or: scopes };
}

/** Global shapes with no assigned user are visible to everyone; assigned shapes only to that user.
 * Shapes hidden for the user (clone deleted) are excluded. */
function globalShapeVisibilityFilter(ownerEmail) {
  return {
    ...(ownerEmail ? { hidden_for_users: { $ne: ownerEmail } } : {}),
    $or: [
      { user_email: { $in: [null, ""] } },
      { user_email: { $exists: false } },
      { user_email: ownerEmail },
    ],
  };
}

export function isGlobalShapeVisibleToUser(shape, userEmail) {
  const assignedTo = shape.user_email;
  if (!assignedTo) return true;
  return assignedTo === userEmail;
}

/**
 * Returns: all global active shapes + custom shapes assigned to the project's owner (user/company)
 * + legacy project-specific custom shapes.
 */
export async function getAvailableShapesForProject(projectId, category = "beam") {
  const availableShapes = [];
  const ownerEmail = await getProjectOwnerEmail(projectId);

  const customShapes = await customShapeLibraryCollection
    .find({
      ...customShapeScopeFilter(projectId, ownerEmail),
      type: "custom_shape",
      category,
      is_active: true,
    })
    .sort({ shape_name: 1 })
    .toArray();

  // A user-scoped clone replaces its global original for this user's projects.
  const clonedGlobalIds = new Set(
    customShapes.map((shape) => shape.cloned_from).filter(Boolean)
  );

  const globalShapes = await shapeLibraryCollection
    .find({ category, is_active: true, ...globalShapeVisibilityFilter(ownerEmail) })
    .sort({ shape_name: 1 })
    .toArray();

  for (const shape of globalShapes) {
    const shapeId = String(shape._id);
    if (clonedGlobalIds.has(shapeId)) continue;

    const overrideExists = await customShapeLibraryCollection.findOne({
      project_id: projectId,
      type: "formula_override",
      base_shape_id: shapeId,
      is_active: true,
    });

    let label = shape.shape_name || "Untitled shape";
    if (overrideExists) label = `${label} (project formula available)`;

    availableShapes.push({
      option_label: label,
      option_key: `global:${shapeId}`,
      shape_id: shapeId,
      shape_name: shape.shape_name,
      shape_source: "global",
    });
  }

  for (const shape of customShapes) {
    const customShapeId = String(shape._id);
    availableShapes.push({
      option_label: `${shape.shape_name || "Custom Shape"} (Custom shape)`,
      option_key: `custom:${customShapeId}`,
      shape_id: customShapeId,
      shape_name: shape.shape_name,
      shape_source: "custom",
    });
  }

  return availableShapes;
}

/**
 * Returns the effective shape for calculation.
 * Global: load global shape, apply project-specific formula overrides (per-output).
 * Custom: return project-specific custom shape directly.
 */
export async function resolveShapeForProject(projectId, selectedShapeKey = null, shapeId = null) {
  let source, selectedId;

  if (selectedShapeKey) {
    [source, selectedId] = selectedShapeKey.split(":", 2);
  } else {
    source = "global";
    selectedId = shapeId;
  }

  if (source === "custom") {
    const oid = toObjectId(selectedId);
    if (!oid) return null;

    const customShape = await customShapeLibraryCollection.findOne({
      _id: oid,
      ...customShapeScopeFilter(projectId, await getProjectOwnerEmail(projectId)),
      type: "custom_shape",
      is_active: true,
    });

    if (!customShape) return null;

    const resolvedShape = structuredClone(customShape);
    resolvedShape.shape_source = "custom";
    resolvedShape.shape_id = String(customShape._id);
    resolvedShape.custom_shape_id = String(customShape._id);
    resolvedShape.base_shape_id = null;

    for (const output of resolvedShape.outputs || []) {
      output.formula_source = "project_custom_shape";
    }

    return resolvedShape;
  }

  const globalOid = toObjectId(selectedId);
  if (!globalOid) return null;

  const globalShape = await shapeLibraryCollection.findOne({ _id: globalOid });
  if (!globalShape) return null;

  if (!isGlobalShapeVisibleToUser(globalShape, await getProjectOwnerEmail(projectId))) {
    return null;
  }

  const resolvedShape = structuredClone(globalShape);
  resolvedShape.shape_source = "global";
  resolvedShape.shape_id = String(globalShape._id);
  resolvedShape.base_shape_id = String(globalShape._id);
  resolvedShape.custom_shape_id = null;

  const overrideDoc = await customShapeLibraryCollection.findOne({
    project_id: projectId,
    type: "formula_override",
    base_shape_id: String(globalShape._id),
    is_active: true,
  });

  const overrideOutputs = {};
  if (overrideDoc) {
    for (const output of overrideDoc.override_outputs || []) {
      overrideOutputs[(output.output_name || "").toLowerCase()] = output;
    }
  }

  const mergedOutputs = [];
  for (const output of globalShape.outputs || []) {
    const mergedOutput = structuredClone(output);
    const outputName = (output.output_name || "").toLowerCase();

    if (outputName in overrideOutputs) {
      const override = overrideOutputs[outputName];
      mergedOutput.formula = override.formula;
      mergedOutput.unit = override.unit || output.unit || "m";
      mergedOutput.formula_source = "project_custom";
      mergedOutput.ai_request_id = override.ai_request_id;
    } else {
      mergedOutput.formula_source = "global";
    }

    mergedOutputs.push(mergedOutput);
  }

  resolvedShape.outputs = mergedOutputs;

  return resolvedShape;
}

/** Creates or updates one project-specific formula override (find-or-create by project_id+base_shape_id, upsert one output entry by name). */
export async function upsertProjectFormulaOverride({
  projectId,
  projectName,
  category,
  baseShapeId,
  baseShapeName,
  outputName,
  formula,
  unit,
  aiRequestId,
  adminEmail,
}) {
  const existingDoc = await customShapeLibraryCollection.findOne({
    project_id: projectId,
    type: "formula_override",
    base_shape_id: baseShapeId,
    is_active: true,
  });

  const newOverride = {
    output_name: outputName,
    formula,
    unit: unit || "m",
    source: "ai_request",
    ai_request_id: aiRequestId,
    updated_by: adminEmail,
    updated_at: new Date(),
  };

  if (existingDoc) {
    const overrideOutputs = existingDoc.override_outputs || [];
    let found = false;

    for (const output of overrideOutputs) {
      if ((output.output_name || "").toLowerCase() === outputName.toLowerCase()) {
        Object.assign(output, newOverride);
        found = true;
        break;
      }
    }

    if (!found) overrideOutputs.push(newOverride);

    await customShapeLibraryCollection.updateOne(
      { _id: existingDoc._id },
      { $set: { override_outputs: overrideOutputs, updated_by: adminEmail, updated_at: new Date() } }
    );

    return String(existingDoc._id);
  }

  const document = {
    project_id: projectId,
    project_name: projectName,
    type: "formula_override",
    category,
    base_shape_id: baseShapeId,
    base_shape_name: baseShapeName,
    override_outputs: [newOverride],
    is_active: true,
    created_by: adminEmail,
    updated_by: adminEmail,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const result = await customShapeLibraryCollection.insertOne(document);
  return String(result.insertedId);
}
