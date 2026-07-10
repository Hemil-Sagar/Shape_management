import { Router } from "express";
import { projectsCollection, toObjectId } from "../db/index.js";

const router = Router();

function toJson(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// ponytail: generate_project_code() counts documents to derive the next code.
// This has the same race-condition/gap risk as the original Python (concurrent
// creates can produce duplicate codes, deletions can produce gaps). Not fixed
// here — a faithful port; a real fix would use an atomic counter collection.
async function generateProjectCode() {
  const count = await projectsCollection.countDocuments({});
  const next = count + 1;
  return `PROJ${String(next).padStart(4, "0")}`;
}

// GET /api/projects — list, scoped by role (admin sees all, user sees own only)
router.get("/", async (req, res) => {
  const searchText = req.query.searchText || "";
  const query = {};

  if (req.user.role !== "admin") {
    query.created_by = req.user.email;
  }

  if (searchText) {
    query.project_name = { $regex: searchText, $options: "i" };
  }

  const projects = await projectsCollection.find(query).sort({ created_at: -1 }).toArray();
  res.json(projects.map(toJson));
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Project not found." });

  const project = await projectsCollection.findOne({ _id: oid });
  if (!project) return res.status(404).json({ error: "Project not found." });

  res.json(toJson(project));
});

// POST /api/projects
router.post("/", async (req, res) => {
  const { project_name, description, start_date, end_date } = req.body;

  if (!project_name || !start_date || !end_date) {
    return res.status(400).json({ error: "Project name, start date, and end date are required." });
  }

  const now = new Date();
  const projectData = {
    project_code: await generateProjectCode(),
    project_name,
    description: description || "",
    start_date: String(start_date),
    end_date: String(end_date),
    created_by: req.user.email,
    created_by_name: req.user.name,
    created_at: now,
    updated_at: now,
    status: "active",
  };

  const result = await projectsCollection.insertOne(projectData);
  res.status(201).json(toJson({ _id: result.insertedId, ...projectData }));
});

// PATCH /api/projects/:id
router.patch("/:id", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Project not found." });

  const updateData = { ...req.body, updated_at: new Date() };
  delete updateData.id;
  delete updateData._id;

  const result = await projectsCollection.updateOne({ _id: oid }, { $set: updateData });
  if (result.matchedCount === 0) return res.status(404).json({ error: "Project not found." });

  const updated = await projectsCollection.findOne({ _id: oid });
  res.json(toJson(updated));
});

export default router;
