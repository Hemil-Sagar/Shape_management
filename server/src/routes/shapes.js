import { Router } from "express";
import multer from "multer";
import { shapeLibraryCollection, customShapeLibraryCollection, toObjectId } from "../db/index.js";
import { requireRole } from "../middleware/auth.js";
import { saveUploadedImageToMongodb } from "../services/imageService.js";
import {
  getAvailableShapesForProject,
  resolveShapeForProject,
} from "../services/shapeResolver.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function toJson(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

/** Mirrors ui/admin_shapes.py::validate_output_rows exactly (trim, required
 * output_name, required formula, default unit "m"). */
function validateOutputRows(outputRows) {
  const cleaned = [];

  for (const row of outputRows || []) {
    const outputName = (row.output_name || "").trim();
    const formula = (row.formula || "").trim();
    const unit = (row.unit || "").trim() || "m";

    if (!outputName) {
      return { ok: false, error: "Output name is required." };
    }
    if (!formula) {
      return { ok: false, error: `Formula is required for ${outputName}.` };
    }

    cleaned.push({ output_name: outputName, formula, unit });
  }

  return { ok: true, error: "", outputs: cleaned };
}

// GET /api/shapes?category=beam&searchText=&statusFilter=All|Active|Inactive
// Mirrors list_shapes (category + status filter + case-insensitive shape_name search).
router.get("/", async (req, res) => {
  const { category, searchText, statusFilter } = req.query;
  const query = {};

  if (category) query.category = category;

  if (statusFilter === "Active") query.is_active = true;
  else if (statusFilter === "Inactive") query.is_active = false;

  if (searchText) {
    query.shape_name = { $regex: searchText, $options: "i" };
  }

  const shapes = await shapeLibraryCollection.find(query).sort({ created_at: -1 }).toArray();
  res.json(shapes.map(toJson));
});

// GET /api/shapes/assigned?userEmail=X — shapes restricted to one user (admin only).
router.get("/assigned", requireRole("admin"), async (req, res) => {
  const { userEmail } = req.query;
  if (!userEmail) return res.status(400).json({ error: "userEmail query parameter is required." });

  const shapes = await shapeLibraryCollection
    .find({ user_email: userEmail })
    .sort({ shape_name: 1 })
    .toArray();

  res.json(shapes.map(toJson));
});

// GET /api/shapes/visible-to-user?userEmail=X (admin) — every library shape this user
// sees in their projects: unassigned globals + globals assigned to them, minus ones
// replaced by an active clone. Mirrors shapeResolver visibility, user-scoped.
router.get("/visible-to-user", requireRole("admin"), async (req, res) => {
  const { userEmail } = req.query;
  if (!userEmail) return res.status(400).json({ error: "userEmail query parameter is required." });

  const clones = await customShapeLibraryCollection
    .find(
      { user_email: userEmail, type: "custom_shape", is_active: true, cloned_from: { $ne: null } },
      { projection: { cloned_from: 1 } }
    )
    .toArray();
  const clonedIds = new Set(clones.map((c) => c.cloned_from));

  const shapes = await shapeLibraryCollection
    .find({
      is_active: true,
      $or: [
        { user_email: { $in: [null, ""] } },
        { user_email: { $exists: false } },
        { user_email: userEmail },
      ],
    })
    .sort({ shape_name: 1 })
    .toArray();

  res.json(shapes.filter((s) => !clonedIds.has(String(s._id))).map(toJson));
});

// GET /api/shapes/available-for-project?projectId=X&category=beam
router.get("/available-for-project", async (req, res) => {
  const { projectId, category } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId query parameter is required." });

  const shapes = await getAvailableShapesForProject(projectId, category || "beam");
  res.json(shapes);
});

// GET /api/shapes/resolve?projectId=X&selectedShapeKey=Y&shapeId=Z
router.get("/resolve", async (req, res) => {
  const { projectId, selectedShapeKey, shapeId } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId query parameter is required." });

  const resolved = await resolveShapeForProject(projectId, selectedShapeKey || null, shapeId || null);
  if (!resolved) return res.status(404).json({ error: "Could not resolve shape for this project." });

  res.json(resolved);
});

// GET /api/shapes/:id
router.get("/:id", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Shape not found." });

  const shape = await shapeLibraryCollection.findOne({ _id: oid });
  if (!shape) return res.status(404).json({ error: "Shape not found." });

  res.json(toJson(shape));
});

// POST /api/shapes (admin) — create_shape / create_global_shape.
router.post("/", requireRole("admin"), upload.single("image"), async (req, res) => {
  const shapeName = (req.body.shape_name || "").trim();
  const category = req.body.category || "beam";
  const description = req.body.description || "";
  const userEmail = req.body.user_email || null;
  const userName = req.body.user_name || null;

  if (!shapeName) {
    return res.status(400).json({ error: "Shape name is required." });
  }

  const duplicate = await shapeLibraryCollection.findOne({
    shape_name: shapeName,
    category,
  });
  if (duplicate) {
    return res
      .status(409)
      .json({ error: "A general shape with this name already exists in this category." });
  }

  let outputRows = req.body.outputs;
  if (typeof outputRows === "string") {
    try {
      outputRows = JSON.parse(outputRows);
    } catch {
      outputRows = [];
    }
  }

  const validation = validateOutputRows(outputRows);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  let imageFields = {
    image_file_id: null,
    image_filename: null,
    image_mime_type: null,
    image_storage: null,
  };
  if (req.file) {
    imageFields = await saveUploadedImageToMongodb(req.file, {
      category,
      shapeName,
      uploadedBy: req.user.email,
      source: "admin_general_shape_upload",
    });
  }

  const now = new Date();
  const shapeData = {
    shape_name: shapeName,
    category,
    description,
    user_email: userEmail,
    user_name: userName,
    image_path: null,
    ...imageFields,
    outputs: validation.outputs,
    is_active: true,
    created_by: req.user.email,
    updated_by: req.user.email,
    created_at: now,
    updated_at: now,
  };

  const result = await shapeLibraryCollection.insertOne(shapeData);
  res.status(201).json(toJson({ _id: result.insertedId, ...shapeData }));
});

// PATCH /api/shapes/:id (admin) — update_shape / update_global_shape.
router.patch("/:id", requireRole("admin"), upload.single("image"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Shape not found." });

  const existing = await shapeLibraryCollection.findOne({ _id: oid });
  if (!existing) return res.status(404).json({ error: "Shape not found." });

  const shapeName = (req.body.shape_name || "").trim();
  const category = req.body.category || existing.category;
  const description = req.body.description ?? existing.description;
  const userEmail = req.body.user_email ?? existing.user_email ?? null;
  const userName = req.body.user_name ?? existing.user_name ?? null;
  const isActive = req.body.is_active === undefined ? existing.is_active : req.body.is_active === "true" || req.body.is_active === true;

  if (!shapeName) {
    return res.status(400).json({ error: "Shape name is required." });
  }

  const duplicate = await shapeLibraryCollection.findOne({
    _id: { $ne: oid },
    shape_name: shapeName,
    category,
  });
  if (duplicate) {
    return res
      .status(409)
      .json({ error: "A general shape with this name already exists in this category." });
  }

  let outputRows = req.body.outputs;
  if (typeof outputRows === "string") {
    try {
      outputRows = JSON.parse(outputRows);
    } catch {
      outputRows = [];
    }
  }

  const validation = validateOutputRows(outputRows);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  // Image fields default to whatever already exists; only replaced if a new file is uploaded.
  let imageFields = {
    image_path: existing.image_path ?? null,
    image_file_id: existing.image_file_id ?? null,
    image_filename: existing.image_filename ?? null,
    image_mime_type: existing.image_mime_type ?? null,
    image_storage: existing.image_storage ?? null,
  };

  if (req.file) {
    // TODO: the old GridFS blob (existing.image_file_id) is not deleted here — same
    // orphan-blob behavior as the original Python (admin_edit_shape_form). Consider
    // calling deleteMongodbImage(existing.image_file_id) once cleanup is desired.
    const uploaded = await saveUploadedImageToMongodb(req.file, {
      category,
      shapeName,
      uploadedBy: req.user.email,
      source: "admin_general_shape_upload",
    });
    imageFields = { image_path: null, ...uploaded };
  }

  const updateData = {
    shape_name: shapeName,
    description,
    user_email: userEmail,
    user_name: userName,
    ...imageFields,
    outputs: validation.outputs,
    is_active: isActive,
    updated_by: req.user.email,
    updated_at: new Date(),
  };

  await shapeLibraryCollection.updateOne({ _id: oid }, { $set: updateData });
  const updated = await shapeLibraryCollection.findOne({ _id: oid });
  res.json(toJson(updated));
});

// POST /api/shapes/:id/deactivate (admin)
router.post("/:id/deactivate", requireRole("admin"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Shape not found." });

  const result = await shapeLibraryCollection.updateOne(
    { _id: oid },
    { $set: { is_active: false, updated_at: new Date() } }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: "Shape not found." });

  res.json(toJson(await shapeLibraryCollection.findOne({ _id: oid })));
});

// POST /api/shapes/:id/reactivate (admin)
router.post("/:id/reactivate", requireRole("admin"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Shape not found." });

  const result = await shapeLibraryCollection.updateOne(
    { _id: oid },
    { $set: { is_active: true, updated_at: new Date() } }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: "Shape not found." });

  res.json(toJson(await shapeLibraryCollection.findOne({ _id: oid })));
});

// DELETE /api/shapes/:id (admin) — delete_global_shape_permanently (hard delete).
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Shape not found." });

  const result = await shapeLibraryCollection.deleteOne({ _id: oid });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Shape not found." });

  res.status(204).send();
});

export default router;
