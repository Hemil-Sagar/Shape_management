import { Router } from "express";
import { blocksCollection, toObjectId } from "../db/index.js";

const router = Router();

function toJson(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// GET /api/blocks?projectId=X&searchText=Y
router.get("/", async (req, res) => {
  const { projectId, searchText } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: "projectId query parameter is required." });
  }

  const query = { project_id: projectId };
  if (searchText) {
    query.block_name = { $regex: searchText, $options: "i" };
  }

  const blocks = await blocksCollection.find(query).sort({ created_at: -1 }).toArray();
  res.json(blocks.map(toJson));
});

// GET /api/blocks/:id
router.get("/:id", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Block not found." });

  const block = await blocksCollection.findOne({ _id: oid });
  if (!block) return res.status(404).json({ error: "Block not found." });

  res.json(toJson(block));
});

// POST /api/blocks
router.post("/", async (req, res) => {
  const { project_id, project_code, block_name, block_description } = req.body;

  if (!project_id || !block_name) {
    return res.status(400).json({ error: "Project and block name are required." });
  }

  const now = new Date();
  const blockData = {
    project_id,
    project_code,
    block_name,
    block_description: block_description || "",
    created_by: req.user.email,
    created_by_name: req.user.name,
    created_at: now,
    updated_at: now,
    status: "active",
  };

  const result = await blocksCollection.insertOne(blockData);
  res.status(201).json(toJson({ _id: result.insertedId, ...blockData }));
});

export default router;
