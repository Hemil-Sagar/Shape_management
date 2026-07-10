import { Router } from "express";
import { ObjectId } from "mongodb";
import { aiRequestsCollection, shapeLibraryCollection, toObjectId } from "../db/index.js";
import { requireRole } from "../middleware/auth.js";
import { upsertProjectFormulaOverride } from "../services/shapeResolver.js";
import { approveNewShapeRequestToProject } from "./customShapes.js";

const router = Router();

function toJson(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

/** Shared internal function for both apply routes — mark_ai_request_applied and
 * mark_ai_request_applied_new_shape were byte-identical in the Python, so this
 * single function backs both apply-formula-update and apply-new-shape. */
async function markAiRequestApplied(requestOid, adminEmail, adminComment, customShapeLibraryId) {
  await aiRequestsCollection.updateOne(
    { _id: requestOid },
    {
      $set: {
        status: "applied",
        scope: "project",
        custom_shape_library_id: customShapeLibraryId,
        admin_comment: adminComment || "",
        applied_by: adminEmail,
        applied_at: new Date(),
        updated_at: new Date(),
      },
    }
  );
}

// POST /api/ai-requests — create_ai_request_document.
// Improvement over the Python: precompute the ObjectId so request_code can be set
// in the same insert (single write instead of insert-then-update).
router.post("/", async (req, res) => {
  const requestData = { ...req.body };
  delete requestData.id;
  delete requestData._id;

  const insertedId = new ObjectId();
  const requestCode = `AIR-${insertedId.toHexString().slice(-6).toUpperCase()}`;
  const now = new Date();

  const document = {
    ...requestData,
    _id: insertedId,
    request_code: requestCode,
    status: requestData.status || "pending",
    requested_by: req.user.email,
    requested_by_name: req.user.name,
    created_at: now,
    updated_at: now,
  };

  await aiRequestsCollection.insertOne(document);
  res.status(201).json(toJson(document));
});

// GET /api/ai-requests/mine?statusFilter=All&searchText= — scoped to the current user.
router.get("/mine", async (req, res) => {
  const { statusFilter, searchText } = req.query;

  const query = { requested_by: req.user.email };

  if (statusFilter && statusFilter !== "All") {
    query.status = statusFilter.toLowerCase();
  }

  if (searchText) {
    query.$or = [
      { request_code: { $regex: searchText, $options: "i" } },
      { project_name: { $regex: searchText, $options: "i" } },
      { shape_name: { $regex: searchText, $options: "i" } },
      { output_name: { $regex: searchText, $options: "i" } },
    ];
  }

  const requests = await aiRequestsCollection.find(query).sort({ created_at: -1 }).toArray();
  res.json(requests.map(toJson));
});

// GET /api/ai-requests?statusFilter=All&requestTypeFilter=All&searchText= (admin)
router.get("/", requireRole("admin"), async (req, res) => {
  const { statusFilter, requestTypeFilter, searchText } = req.query;

  const query = {};

  if (statusFilter && statusFilter !== "All") {
    query.status = statusFilter.toLowerCase();
  }

  if (requestTypeFilter && requestTypeFilter !== "All") {
    query.request_type = requestTypeFilter;
  }

  if (searchText) {
    query.$or = [
      { request_code: { $regex: searchText, $options: "i" } },
      { project_name: { $regex: searchText, $options: "i" } },
      { shape_name: { $regex: searchText, $options: "i" } },
      { output_name: { $regex: searchText, $options: "i" } },
      { requested_by: { $regex: searchText, $options: "i" } },
    ];
  }

  const requests = await aiRequestsCollection.find(query).sort({ created_at: -1 }).toArray();
  res.json(requests.map(toJson));
});

// GET /api/ai-requests/:id
router.get("/:id", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "AI request not found." });

  const request = await aiRequestsCollection.findOne({ _id: oid });
  if (!request) return res.status(404).json({ error: "AI request not found." });

  res.json(toJson(request));
});

// POST /api/ai-requests/:id/apply-formula-update (admin) — ports
// ui/admin_ai_requests.py::apply_formula_update_request.
router.post("/:id/apply-formula-update", requireRole("admin"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "AI request not found." });

  const request = await aiRequestsCollection.findOne({ _id: oid });
  if (!request) return res.status(404).json({ error: "AI request not found." });

  const { admin_comment: adminComment } = req.body;

  if (
    !request.project_id ||
    !request.shape_id ||
    !request.shape_name ||
    !request.output_name ||
    !request.requested_formula
  ) {
    return res.status(400).json({ error: "Request is missing required fields to apply." });
  }

  const shapeOid = toObjectId(request.shape_id);
  if (!shapeOid) return res.status(404).json({ error: "Base shape not found." });

  const baseShape = await shapeLibraryCollection.findOne({ _id: shapeOid });
  if (!baseShape) return res.status(404).json({ error: "Base shape not found." });

  const targetOutputName = String(request.output_name).toLowerCase();
  const matchedOutput = (baseShape.outputs || []).find(
    (output) => String(output.output_name || "").toLowerCase() === targetOutputName
  );

  if (!matchedOutput) {
    return res
      .status(400)
      .json({ error: `Output "${request.output_name}" was not found on the base shape.` });
  }

  const unit = matchedOutput.unit || "m";

  const customShapeLibraryId = await upsertProjectFormulaOverride({
    projectId: request.project_id,
    projectName: request.project_name,
    category: request.category || "beam",
    baseShapeId: request.shape_id,
    baseShapeName: request.shape_name,
    outputName: request.output_name,
    formula: request.requested_formula,
    unit,
    aiRequestId: String(request._id),
    adminEmail: req.user.email,
  });

  await markAiRequestApplied(oid, req.user.email, adminComment, customShapeLibraryId);

  const updated = await aiRequestsCollection.findOne({ _id: oid });
  res.json(toJson(updated));
});

// POST /api/ai-requests/:id/apply-new-shape (admin) — calls the shared
// approveNewShapeRequestToProject logic then marks the request applied.
router.post("/:id/apply-new-shape", requireRole("admin"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "AI request not found." });

  const request = await aiRequestsCollection.findOne({ _id: oid });
  if (!request) return res.status(404).json({ error: "AI request not found." });

  const { admin_comment: adminComment } = req.body;

  let customShapeLibraryId;
  try {
    customShapeLibraryId = await approveNewShapeRequestToProject(request, req.user.email);
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    throw error;
  }

  await markAiRequestApplied(oid, req.user.email, adminComment, customShapeLibraryId);

  const updated = await aiRequestsCollection.findOne({ _id: oid });
  res.json(toJson(updated));
});

// POST /api/ai-requests/:id/reject (admin) — reject_ai_request.
router.post("/:id/reject", requireRole("admin"), async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "AI request not found." });

  const { admin_comment: adminComment } = req.body;

  const result = await aiRequestsCollection.updateOne(
    { _id: oid },
    {
      $set: {
        status: "rejected",
        admin_comment: adminComment || "",
        rejected_by: req.user.email,
        rejected_at: new Date(),
        updated_at: new Date(),
      },
    }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: "AI request not found." });

  const updated = await aiRequestsCollection.findOne({ _id: oid });
  res.json(toJson(updated));
});

export default router;
