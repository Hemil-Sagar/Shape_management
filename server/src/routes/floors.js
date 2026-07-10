import { Router } from "express";
import { floorsCollection, toObjectId } from "../db/index.js";

const router = Router();

function toJson(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// GET /api/floors?projectId=X&blockId=Y&searchText=Z
router.get("/", async (req, res) => {
  const { projectId, blockId, searchText } = req.query;

  if (!projectId || !blockId) {
    return res.status(400).json({ error: "projectId and blockId query parameters are required." });
  }

  const query = { project_id: projectId, block_id: blockId };
  if (searchText) {
    query.floor_name = { $regex: searchText, $options: "i" };
  }

  const floors = await floorsCollection.find(query).sort({ created_at: -1 }).toArray();
  res.json(floors.map(toJson));
});

// GET /api/floors/:id
router.get("/:id", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Floor not found." });

  const floor = await floorsCollection.findOne({ _id: oid });
  if (!floor) return res.status(404).json({ error: "Floor not found." });

  res.json(toJson(floor));
});

// POST /api/floors
router.post("/", async (req, res) => {
  const { project_id, block_id, project_code, block_name, floor_name, floor_description } = req.body;

  if (!project_id || !block_id || !floor_name) {
    return res.status(400).json({ error: "Project, block, and floor name are required." });
  }

  const now = new Date();
  const floorData = {
    project_id,
    block_id,
    project_code,
    block_name,
    floor_name,
    floor_description: floor_description || "",
    created_by: req.user.email,
    created_by_name: req.user.name,
    created_at: now,
    updated_at: now,
    status: "active",
  };

  const result = await floorsCollection.insertOne(floorData);
  res.status(201).json(toJson({ _id: result.insertedId, ...floorData }));
});

export default router;
