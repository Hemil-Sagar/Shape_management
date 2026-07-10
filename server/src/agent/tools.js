import { projectsCollection, shapeLibraryCollection, toObjectId } from "../db/index.js";

/** Port of agent/tools.py::find_user_projects. */
export async function findUserProjects(userEmail) {
  return projectsCollection
    .find(
      { created_by: userEmail },
      { projection: { project_name: 1, project_code: 1, created_by: 1, created_at: 1 } }
    )
    .sort({ created_at: -1 })
    .toArray();
}

/** Port of agent/tools.py::find_project_by_name — exact case-insensitive match. */
export async function findProjectByName(userEmail, projectName) {
  return projectsCollection.findOne({
    created_by: userEmail,
    project_name: { $regex: `^${projectName}$`, $options: "i" },
  });
}

/** Port of agent/tools.py::find_shape_by_name — exact case-insensitive match, active shapes only. */
export async function findShapeByName(category, shapeName) {
  return shapeLibraryCollection.findOne({
    category,
    shape_name: { $regex: `^${shapeName}$`, $options: "i" },
    is_active: true,
  });
}

/** Port of agent/tools.py::get_shape_by_id — returns null on invalid id instead of throwing. */
export async function getShapeById(shapeId) {
  const oid = toObjectId(shapeId);
  if (!oid) return null;
  return shapeLibraryCollection.findOne({ _id: oid });
}

/** Port of agent/tools.py::get_current_formula — case-insensitive scan of shape.outputs. */
export function getCurrentFormula(shape, outputName) {
  if (!shape) return null;

  const outputs = shape.outputs || [];

  for (const output of outputs) {
    if ((output.output_name || "").toLowerCase() === outputName.toLowerCase()) {
      return output.formula ?? null;
    }
  }

  return null;
}

/** Port of agent/tools.py::get_shape_output_names. */
export function getShapeOutputNames(shape) {
  if (!shape) return [];

  return (shape.outputs || [])
    .map((output) => output.output_name)
    .filter((name) => Boolean(name));
}

/** Port of agent/tools.py::list_active_shapes — same visibility OR-query as shapeResolver. */
export async function listActiveShapes(category = "beam", userEmail = null) {
  const query = { category, is_active: true };

  if (userEmail) {
    query.$or = [
      { user_email: { $in: [null, ""] } },
      { user_email: { $exists: false } },
      { user_email: userEmail },
    ];
  }

  return shapeLibraryCollection
    .find(query, { projection: { shape_name: 1, category: 1, outputs: 1 } })
    .sort({ shape_name: 1 })
    .toArray();
}
