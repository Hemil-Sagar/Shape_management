import { Router } from "express";
import {
  usersCollection,
  projectsCollection,
  autocadImportsCollection,
  beamsCollection,
  aiRequestsCollection,
  toObjectId,
} from "../db/index.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireRole("admin"));

function toJson(doc) {
  if (!doc) return null;
  const { _id, password, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// GET /api/admin/users?searchText=X&roleFilter=Y (roleFilter default "user", same as original)
router.get("/", async (req, res) => {
  const searchText = req.query.searchText || "";
  const roleFilter = req.query.roleFilter || "user";

  const query = {};
  if (roleFilter && roleFilter !== "All") {
    query.role = roleFilter.toLowerCase();
  }
  if (searchText) {
    query.$or = [
      { name: { $regex: searchText, $options: "i" } },
      { email: { $regex: searchText, $options: "i" } },
      { role: { $regex: searchText, $options: "i" } },
    ];
  }

  const users = await usersCollection.find(query).sort({ created_at: -1 }).toArray();
  res.json(users.map(toJson));
});

// GET /api/admin/users/:id — user detail + aggregated stats in one response
router.get("/:id", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "User not found." });

  const user = await usersCollection.findOne({ _id: oid });
  if (!user) return res.status(404).json({ error: "User not found." });

  const email = user.email;

  const [projectsCount, autocadImportsCount, beamsCount, filledBeamsCount, aiRequestsCount, projects] =
    await Promise.all([
      projectsCollection.countDocuments({ created_by: email }),
      autocadImportsCollection.countDocuments({ imported_by: email }),
      beamsCollection.countDocuments({ created_by: email }),
      beamsCollection.countDocuments({ created_by: email, status: "Filled" }),
      aiRequestsCollection.countDocuments({ requested_by: email }),
      projectsCollection.find({ created_by: email }).sort({ created_at: -1 }).toArray(),
    ]);

  res.json({
    user: toJson(user),
    stats: {
      projects_count: projectsCount,
      autocad_imports_count: autocadImportsCount,
      beams_count: beamsCount,
      filled_beams_count: filledBeamsCount,
      ai_requests_count: aiRequestsCount,
    },
    projects: projects.map(toJson),
  });
});

export default router;
