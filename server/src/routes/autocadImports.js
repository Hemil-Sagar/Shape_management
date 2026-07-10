import { Router } from "express";
import { autocadImportsCollection, toObjectId } from "../db/index.js";

const router = Router();

function toJson(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// GET /api/autocad-imports?projectId=X&searchText=Y&statusFilter=Z
router.get("/", async (req, res) => {
  const { projectId, searchText, statusFilter } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: "projectId query parameter is required." });
  }

  const query = { project_id: projectId };
  if (searchText) {
    query.name = { $regex: searchText, $options: "i" };
  }
  if (statusFilter && statusFilter !== "All") {
    query.status = statusFilter;
  }

  const imports = await autocadImportsCollection.find(query).sort({ imported_at: -1 }).toArray();
  res.json(imports.map(toJson));
});

// GET /api/autocad-imports/:id
router.get("/:id", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "AutoCAD import not found." });

  const doc = await autocadImportsCollection.findOne({ _id: oid });
  if (!doc) return res.status(404).json({ error: "AutoCAD import not found." });

  res.json(toJson(doc));
});

// POST /api/autocad-imports
router.post("/", async (req, res) => {
  const {
    project_id,
    project_code,
    import_name,
    block_id,
    block_name,
    floor_id,
    floor_name,
    drawing_number,
    structure_name,
  } = req.body;

  if (!project_id || !import_name || !block_id || !floor_id) {
    return res.status(400).json({ error: "Project, block, floor, and import name are required." });
  }

  const now = new Date();
  const importData = {
    project_id,
    project_code,
    name: import_name,
    block_id,
    block_name,
    floor_id,
    floor_name,
    drawing_number: drawing_number || "",
    structure_name: structure_name || "",
    imported_by: req.user.email,
    imported_by_name: req.user.name,
    imported_at: now,
    updated_at: now,
    status: "Pending",
  };

  const result = await autocadImportsCollection.insertOne(importData);
  res.status(201).json(toJson({ _id: result.insertedId, ...importData }));
});

export default router;
