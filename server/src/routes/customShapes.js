import { Router } from "express";
import multer from "multer";
import {
  customShapeLibraryCollection,
  shapeLibraryCollection,
  aiRequestsCollection,
  projectsCollection,
  toObjectId,
} from "../db/index.js";
import { requireRole } from "../middleware/auth.js";
import { saveUploadedImageToMongodb } from "../services/imageService.js";
import { upsertProjectFormulaOverride } from "../services/shapeResolver.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function toJson(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

/** Mirrors ui/admin_shapes.py::validate_output_rows (trim, required output_name,
 * required formula, default unit "m"). Used for project/user custom-shape outputs. */
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

function parseOutputsBody(rawOutputs) {
  if (typeof rawOutputs === "string") {
    try {
      return JSON.parse(rawOutputs);
    } catch {
      return [];
    }
  }
  return rawOutputs || [];
}

function getCustomizationTypeLabel(customType) {
  const labels = {
    formula_override: "Custom Formula",
    custom_shape: "Custom Shape",
  };
  return labels[customType] ?? (customType || "Customization");
}

function getCustomItemOutputs(customItem) {
  if (customItem.type === "formula_override") return customItem.override_outputs || [];
  if (customItem.type === "custom_shape") return customItem.outputs || [];
  return [];
}

function getCustomItemShapeName(customItem) {
  if (customItem.type === "formula_override") return customItem.base_shape_name ?? "N/A";
  if (customItem.type === "custom_shape") return customItem.shape_name ?? "N/A";
  return "N/A";
}

function getCustomItemDescription(customItem) {
  if (customItem.type === "custom_shape") return customItem.description ?? "";
  if (customItem.type === "formula_override") {
    return `Project-specific formula override for ${customItem.base_shape_name || "selected shape"}.`;
  }
  return "";
}

function fallbackRequestCode(requestId) {
  if (!requestId) return "N/A";
  return `AIR-${String(requestId).slice(-6).toUpperCase()}`;
}

async function getAiRequestForCustomItem(customItem) {
  let requestId = customItem.ai_request_id;

  if (!requestId && customItem.type === "formula_override") {
    const overrideOutputs = customItem.override_outputs || [];
    for (let i = overrideOutputs.length - 1; i >= 0; i--) {
      if (overrideOutputs[i].ai_request_id) {
        requestId = overrideOutputs[i].ai_request_id;
        break;
      }
    }
  }

  if (!requestId) return null;

  const oid = toObjectId(requestId);
  if (!oid) return null;

  return aiRequestsCollection.findOne({ _id: oid });
}

/** The key read-model transformer used everywhere custom items are listed/viewed.
 * Mirrors shape_service.py::enrich_custom_item exactly, including the
 * formula_override -> base shape image fallback branch. */
async function enrichCustomItem(customItem) {
  const enriched = { ...customItem };

  if (!enriched.project_name && enriched.user_email) {
    enriched.project_name = `All projects of ${enriched.user_name || enriched.user_email}`;
  }

  const request = await getAiRequestForCustomItem(customItem);

  let requestId = customItem.ai_request_id || null;
  if (!requestId && customItem.type === "formula_override") {
    const overrideOutputs = customItem.override_outputs || [];
    for (let i = overrideOutputs.length - 1; i >= 0; i--) {
      if (overrideOutputs[i].ai_request_id) {
        requestId = overrideOutputs[i].ai_request_id;
        break;
      }
    }
  }

  if (request) {
    enriched.request_code = request.request_code || fallbackRequestCode(request._id);
    enriched.requested_by_name = request.requested_by_name ?? "N/A";
    enriched.requested_by = request.requested_by ?? "N/A";
    enriched.request_reason = request.reason ?? "N/A";
  } else {
    enriched.request_code = fallbackRequestCode(requestId);
    enriched.requested_by_name = "N/A";
    enriched.requested_by = "N/A";
    enriched.request_reason = "N/A";
  }

  enriched.customization_type_label = getCustomizationTypeLabel(customItem.type);
  enriched.display_shape_name = getCustomItemShapeName(customItem);
  enriched.display_description = getCustomItemDescription(customItem);
  enriched.display_outputs = getCustomItemOutputs(customItem);

  let imagePath = customItem.image_path ?? null;
  let imageFileId = customItem.image_file_id ?? null;
  let imageFilename = customItem.image_filename ?? null;
  let imageMimeType = customItem.image_mime_type ?? null;
  let imageStorage = customItem.image_storage ?? null;

  if (customItem.type === "formula_override") {
    const baseShapeId = customItem.base_shape_id;

    if (baseShapeId) {
      const baseOid = toObjectId(baseShapeId);
      if (baseOid) {
        const baseShape = await shapeLibraryCollection.findOne({ _id: baseOid });
        if (baseShape) {
          imagePath = baseShape.image_path ?? null;
          imageFileId = baseShape.image_file_id ?? null;
          imageFilename = baseShape.image_filename ?? null;
          imageMimeType = baseShape.image_mime_type ?? null;
          imageStorage = baseShape.image_storage ?? null;
        }
      } else {
        imagePath = null;
        imageFileId = null;
        imageFilename = null;
        imageMimeType = null;
        imageStorage = null;
      }
    }
  }

  enriched.display_image_path = imagePath;
  enriched.display_image_file_id = imageFileId;
  enriched.display_image_filename = imageFilename;
  enriched.display_image_mime_type = imageMimeType;
  enriched.display_image_storage = imageStorage;

  return enriched;
}

async function enrichAll(items) {
  return Promise.all(items.map(enrichCustomItem));
}

/** approve_new_shape_request_to_project(request, adminEmail) — converts an approved
 * new_shape AI request into a project custom shape. Throws {status:400, message} on
 * missing project_id / shape_name / outputs, mirroring the Python ValueError messages. */
async function approveNewShapeRequestToProject(request, adminEmail) {
  const payload = request.new_shape_payload || {};

  const projectId = request.project_id;
  const projectName = request.project_name;
  const category = request.category || "beam";

  const shapeName = payload.shape_name || request.shape_name;
  const description = payload.description || "";
  const imagePath = payload.image_path || request.new_shape_image_path || null;

  const imageFileId =
    payload.image_file_id || request.new_shape_image_file_id || request.image_file_id || null;
  const imageFilename =
    payload.image_filename || request.new_shape_image_filename || request.image_filename || null;
  const imageMimeType =
    payload.image_mime_type || request.new_shape_image_mime_type || request.image_mime_type || null;
  const imageStorage =
    payload.image_storage || request.new_shape_image_storage || request.image_storage || null;

  const outputs = payload.outputs || [];

  if (!projectId) {
    const error = new Error("Request is missing project ID.");
    error.status = 400;
    throw error;
  }
  if (!shapeName) {
    const error = new Error("Request is missing shape name.");
    error.status = 400;
    throw error;
  }
  if (!outputs.length) {
    const error = new Error("Request is missing shape outputs.");
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const customShape = {
    project_id: projectId,
    project_name: projectName,
    type: "custom_shape",
    category,
    shape_name: shapeName,
    description,
    image_path: imagePath,
    image_file_id: imageFileId,
    image_filename: imageFilename,
    image_mime_type: imageMimeType,
    image_storage: imageStorage,
    outputs,
    is_active: true,
    created_by: adminEmail,
    updated_by: adminEmail,
    ai_request_id: String(request._id),
    created_at: now,
    updated_at: now,
  };

  const result = await customShapeLibraryCollection.insertOne(customShape);
  return String(result.insertedId);
}

export { approveNewShapeRequestToProject };

// GET /api/custom-shapes?category=beam&searchText=&statusFilter=All|Active|Inactive
router.get("/", async (req, res) => {
  const { category, searchText, statusFilter } = req.query;
  const query = {};

  if (category) query.category = category;

  if (statusFilter === "Active") query.is_active = true;
  else if (statusFilter === "Inactive") query.is_active = false;

  if (searchText) {
    query.$or = [
      { project_name: { $regex: searchText, $options: "i" } },
      { shape_name: { $regex: searchText, $options: "i" } },
      { base_shape_name: { $regex: searchText, $options: "i" } },
      { user_email: { $regex: searchText, $options: "i" } },
      { user_name: { $regex: searchText, $options: "i" } },
    ];
  }

  const items = await customShapeLibraryCollection.find(query).sort({ updated_at: -1 }).toArray();
  const enriched = await enrichAll(items);
  res.json(enriched.map(toJson));
});

// GET /api/custom-shapes/for-user?userEmail=X (admin) — union of user_email match
// OR project_id in that user's projects (legacy compat).
router.get("/for-user", requireRole("admin"), async (req, res) => {
  const { userEmail } = req.query;
  if (!userEmail) return res.status(400).json({ error: "userEmail query parameter is required." });

  const projects = await projectsCollection
    .find({ created_by: userEmail }, { projection: { _id: 1 } })
    .toArray();
  const projectIds = projects.map((p) => String(p._id));

  const query = {
    $or: [{ user_email: userEmail }, { project_id: { $in: projectIds } }],
  };

  const items = await customShapeLibraryCollection.find(query).sort({ updated_at: -1 }).toArray();
  const enriched = await enrichAll(items);
  res.json(enriched.map(toJson));
});

// GET /api/custom-shapes/:id
router.get("/:id", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Custom shape item not found." });

  const item = await customShapeLibraryCollection.findOne({ _id: oid });
  if (!item) return res.status(404).json({ error: "Custom shape item not found." });

  res.json(toJson(await enrichCustomItem(item)));
});

// POST /api/custom-shapes/project — create_project_custom_shape (admin-only: only ever invoked via the approve-new-shape-request flow)
router.post("/project", requireRole("admin"), upload.single("image"), async (req, res) => {
  const projectId = req.body.project_id;
  const projectName = req.body.project_name || null;
  const category = req.body.category || "beam";
  const shapeName = (req.body.shape_name || "").trim();
  const description = req.body.description || "";

  if (!projectId) return res.status(400).json({ error: "project_id is required." });
  if (!shapeName) return res.status(400).json({ error: "Shape name is required." });

  const validation = validateOutputRows(parseOutputsBody(req.body.outputs));
  if (!validation.ok) return res.status(400).json({ error: validation.error });

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
      source: "project_custom_shape_upload",
    });
  }

  const now = new Date();
  const customShape = {
    project_id: projectId,
    project_name: projectName,
    type: "custom_shape",
    category,
    shape_name: shapeName,
    description,
    image_path: null,
    ...imageFields,
    outputs: validation.outputs,
    is_active: true,
    created_by: req.user.email,
    updated_by: req.user.email,
    ai_request_id: req.body.ai_request_id || null,
    created_at: now,
    updated_at: now,
  };

  const result = await customShapeLibraryCollection.insertOne(customShape);
  res.status(201).json(toJson({ _id: result.insertedId, ...customShape }));
});

// POST /api/custom-shapes/user (admin) — create_user_custom_shape
router.post("/user", requireRole("admin"), upload.single("image"), async (req, res) => {
  const userEmail = req.body.user_email;
  const userName = req.body.user_name || null;
  const category = req.body.category || "beam";
  const shapeName = (req.body.shape_name || "").trim();
  const description = req.body.description || "";

  if (!userEmail) return res.status(400).json({ error: "user_email is required." });
  if (!shapeName) return res.status(400).json({ error: "Shape name is required." });

  const duplicate = await customShapeLibraryCollection.findOne({
    user_email: userEmail,
    category,
    type: "custom_shape",
    shape_name: shapeName,
  });
  if (duplicate) {
    return res
      .status(409)
      .json({ error: "A custom shape with this name already exists for this user in this category." });
  }

  const validation = validateOutputRows(parseOutputsBody(req.body.outputs));
  if (!validation.ok) return res.status(400).json({ error: validation.error });

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
      source: "user_custom_shape_upload",
    });
  }

  const now = new Date();
  const customShape = {
    user_email: userEmail,
    user_name: userName,
    project_id: null,
    project_name: null,
    type: "custom_shape",
    category,
    shape_name: shapeName,
    description,
    image_path: null,
    ...imageFields,
    outputs: validation.outputs,
    is_active: true,
    created_by: req.user.email,
    updated_by: req.user.email,
    ai_request_id: null,
    created_at: now,
    updated_at: now,
  };

  const result = await customShapeLibraryCollection.insertOne(customShape);
  res.status(201).json(toJson({ _id: result.insertedId, ...customShape }));
});

// POST /api/custom-shapes/clone-from-global (admin) — clone a global shape into a
// user-scoped custom shape. The clone REPLACES the original for that user: the shape
// resolver hides any global shape that has an active clone (matched via cloned_from)
// from that user's projects.
router.post("/clone-from-global", requireRole("admin"), async (req, res) => {
  const { shape_id: shapeId, user_email: userEmail, user_name: userName } = req.body;

  if (!shapeId || !userEmail) {
    return res.status(400).json({ error: "shape_id and user_email are required." });
  }

  const oid = toObjectId(shapeId);
  if (!oid) return res.status(404).json({ error: "Shape not found." });

  const shape = await shapeLibraryCollection.findOne({ _id: oid });
  if (!shape) return res.status(404).json({ error: "Shape not found." });

  const duplicate = await customShapeLibraryCollection.findOne({
    user_email: userEmail,
    type: "custom_shape",
    cloned_from: String(shape._id),
  });
  if (duplicate) {
    return res.status(409).json({ error: "This shape is already cloned for this user." });
  }

  const now = new Date();
  const customShape = {
    user_email: userEmail,
    user_name: userName || null,
    project_id: null,
    project_name: null,
    type: "custom_shape",
    category: shape.category || "beam",
    shape_name: shape.shape_name,
    description: shape.description || "",
    // ponytail: image GridFS pointer is shared with the original — safe because
    // shape deletion never deletes GridFS blobs (same orphan behavior as Python app).
    image_path: shape.image_path ?? null,
    image_file_id: shape.image_file_id ?? null,
    image_filename: shape.image_filename ?? null,
    image_mime_type: shape.image_mime_type ?? null,
    image_storage: shape.image_storage ?? null,
    outputs: structuredClone(shape.outputs || []),
    cloned_from: String(shape._id),
    cloned_from_name: shape.shape_name,
    is_active: true,
    created_by: req.user.email,
    updated_by: req.user.email,
    ai_request_id: null,
    created_at: now,
    updated_at: now,
  };

  // Re-cloning restores a shape previously hidden for this user by a clone deletion.
  await shapeLibraryCollection.updateOne(
    { _id: oid },
    { $pull: { hidden_for_users: userEmail } }
  );

  const result = await customShapeLibraryCollection.insertOne(customShape);
  res.status(201).json(toJson(await enrichCustomItem({ _id: result.insertedId, ...customShape })));
});

// PATCH /api/custom-shapes/:id/formula-override (admin) — update_custom_formula_override
router.patch("/:id/formula-override", requireRole("admin"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Custom formula override not found." });

  const existingItem = await customShapeLibraryCollection.findOne({
    _id: oid,
    type: "formula_override",
  });
  if (!existingItem) {
    return res.status(404).json({ error: "Custom formula override not found." });
  }

  const oldOutputsByName = {};
  for (const oldOutput of existingItem.override_outputs || []) {
    oldOutputsByName[(oldOutput.output_name || "").toLowerCase()] = oldOutput;
  }

  const cleanedOutputs = [];
  const overrideOutputs = req.body.override_outputs || [];

  for (const output of overrideOutputs) {
    const outputName = (output.output_name || "").trim();
    const formula = (output.formula || "").trim();
    const unit = (output.unit || "m").trim() || "m";

    if (!outputName || !formula) {
      return res.status(400).json({ error: "Each output must have output name and formula." });
    }

    const oldOutput = oldOutputsByName[outputName.toLowerCase()] || {};

    cleanedOutputs.push({
      output_name: outputName,
      formula,
      unit,
      source: "manual_admin_edit",
      ai_request_id: oldOutput.ai_request_id ?? null,
      updated_by: req.user.email,
      updated_at: new Date(),
    });
  }

  const isActive = req.body.is_active === undefined ? existingItem.is_active : !!req.body.is_active;

  await customShapeLibraryCollection.updateOne(
    { _id: oid },
    {
      $set: {
        override_outputs: cleanedOutputs,
        is_active: isActive,
        updated_by: req.user.email,
        updated_at: new Date(),
      },
    }
  );

  const updated = await customShapeLibraryCollection.findOne({ _id: oid });
  res.json(toJson(await enrichCustomItem(updated)));
});

// PATCH /api/custom-shapes/:id (admin) — update_project_custom_shape
router.patch("/:id", requireRole("admin"), upload.single("image"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Custom shape item not found." });

  const existing = await customShapeLibraryCollection.findOne({ _id: oid });
  if (!existing) return res.status(404).json({ error: "Custom shape item not found." });

  const shapeName = (req.body.shape_name || "").trim();
  const description = req.body.description ?? existing.description;

  if (!shapeName) return res.status(400).json({ error: "Shape name is required." });

  const validation = validateOutputRows(parseOutputsBody(req.body.outputs));
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  // Uniqueness scope depends on whether the item is user-scoped or project-scoped.
  if (existing.user_email) {
    const duplicate = await customShapeLibraryCollection.findOne({
      _id: { $ne: oid },
      user_email: existing.user_email,
      category: existing.category,
      type: "custom_shape",
      shape_name: shapeName,
    });
    if (duplicate) {
      return res
        .status(409)
        .json({ error: "A custom shape with this name already exists for this user in this category." });
    }
  } else {
    const duplicate = await customShapeLibraryCollection.findOne({
      _id: { $ne: oid },
      project_id: existing.project_id,
      category: existing.category,
      type: "custom_shape",
      shape_name: shapeName,
    });
    if (duplicate) {
      return res
        .status(409)
        .json({ error: "A custom shape with this name already exists in this project." });
    }
  }

  let imageFields = {
    image_path: existing.image_path ?? null,
    image_file_id: existing.image_file_id ?? null,
    image_filename: existing.image_filename ?? null,
    image_mime_type: existing.image_mime_type ?? null,
    image_storage: existing.image_storage ?? null,
  };

  if (req.file) {
    // TODO: old GridFS blob is not deleted here — same orphan-blob behavior as the
    // original Python (admin_edit_custom_shape_form).
    const uploaded = await saveUploadedImageToMongodb(req.file, {
      category: existing.category,
      shapeName,
      uploadedBy: req.user.email,
      source: "custom_shape_upload",
    });
    imageFields = { image_path: null, ...uploaded };
  }

  const isActive = req.body.is_active === undefined ? existing.is_active : req.body.is_active === "true" || req.body.is_active === true;

  const updateData = {
    shape_name: shapeName,
    description,
    ...imageFields,
    outputs: validation.outputs,
    is_active: isActive,
    updated_by: req.user.email,
    updated_at: new Date(),
  };

  await customShapeLibraryCollection.updateOne({ _id: oid }, { $set: updateData });
  const updated = await customShapeLibraryCollection.findOne({ _id: oid });
  res.json(toJson(await enrichCustomItem(updated)));
});

// POST /api/custom-shapes/:id/deactivate (admin)
router.post("/:id/deactivate", requireRole("admin"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Custom shape item not found." });

  const result = await customShapeLibraryCollection.updateOne(
    { _id: oid },
    { $set: { is_active: false, updated_by: req.user.email, updated_at: new Date() } }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: "Custom shape item not found." });

  res.json(toJson(await enrichCustomItem(await customShapeLibraryCollection.findOne({ _id: oid }))));
});

// POST /api/custom-shapes/:id/reactivate (admin)
router.post("/:id/reactivate", requireRole("admin"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Custom shape item not found." });

  const result = await customShapeLibraryCollection.updateOne(
    { _id: oid },
    { $set: { is_active: true, updated_by: req.user.email, updated_at: new Date() } }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: "Custom shape item not found." });

  res.json(toJson(await enrichCustomItem(await customShapeLibraryCollection.findOne({ _id: oid }))));
});

// DELETE /api/custom-shapes/:id (admin) — hard delete. Deleting a user's clone also
// hides the global original for that user (hidden_for_users tombstone), otherwise the
// original reappears in their list and looks like the delete failed. Re-cloning via
// Import from Shape Library un-hides it.
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Custom shape item not found." });

  const item = await customShapeLibraryCollection.findOne({ _id: oid });
  if (!item) return res.status(404).json({ error: "Custom shape item not found." });

  if (item.cloned_from && item.user_email) {
    const originalOid = toObjectId(item.cloned_from);
    if (originalOid) {
      await shapeLibraryCollection.updateOne(
        { _id: originalOid },
        { $addToSet: { hidden_for_users: item.user_email } }
      );
    }
  }

  const result = await customShapeLibraryCollection.deleteOne({ _id: oid });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Custom shape item not found." });

  res.status(204).send();
});

// POST /api/custom-shapes/apply-formula-override (admin) — wraps
// shapeResolver.upsertProjectFormulaOverride, used by the AI-request approval flow
// (also exposed here for direct admin use).
router.post("/apply-formula-override", requireRole("admin"), async (req, res) => {
  const {
    project_id: projectId,
    project_name: projectName,
    category,
    base_shape_id: baseShapeId,
    base_shape_name: baseShapeName,
    output_name: outputName,
    formula,
    unit,
    ai_request_id: aiRequestId,
  } = req.body;

  if (!projectId || !baseShapeId || !outputName || !formula) {
    return res
      .status(400)
      .json({ error: "project_id, base_shape_id, output_name, and formula are required." });
  }

  const customShapeLibraryId = await upsertProjectFormulaOverride({
    projectId,
    projectName,
    category,
    baseShapeId,
    baseShapeName,
    outputName,
    formula,
    unit,
    aiRequestId: aiRequestId || null,
    adminEmail: req.user.email,
  });

  res.json({ custom_shape_library_id: customShapeLibraryId });
});

// POST /api/custom-shapes/approve-new-shape-request (admin) — converts an approved
// new_shape AI request into create_project_custom_shape.
router.post("/approve-new-shape-request", requireRole("admin"), async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ error: "requestId is required." });

  const oid = toObjectId(requestId);
  if (!oid) return res.status(404).json({ error: "AI request not found." });

  const request = await aiRequestsCollection.findOne({ _id: oid });
  if (!request) return res.status(404).json({ error: "AI request not found." });

  try {
    const customShapeLibraryId = await approveNewShapeRequestToProject(request, req.user.email);
    res.json({ custom_shape_library_id: customShapeLibraryId });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    throw error;
  }
});

export default router;
