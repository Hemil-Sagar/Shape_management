import { Router } from "express";
import {
  usersCollection,
  projectsCollection,
  shapeLibraryCollection,
  autocadImportsCollection,
  beamsCollection,
  aiRequestsCollection,
} from "../db/index.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();

function toJson(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// GET /api/dashboard/admin — stats + recent projects + recent shapes, combined
router.get("/admin", requireRole("admin"), async (req, res) => {
  const [
    totalUsers,
    totalProjects,
    totalShapes,
    totalImports,
    totalBeams,
    filledBeams,
    pendingAiRequests,
    recentProjects,
    recentShapes,
  ] = await Promise.all([
    usersCollection.countDocuments({ role: "user" }),
    projectsCollection.countDocuments({}),
    shapeLibraryCollection.countDocuments({ is_active: true }),
    autocadImportsCollection.countDocuments({}),
    beamsCollection.countDocuments({}),
    beamsCollection.countDocuments({ status: "Filled" }),
    aiRequestsCollection.countDocuments({ status: "pending" }),
    projectsCollection.find({}).sort({ created_at: -1 }).limit(5).toArray(),
    shapeLibraryCollection.find({}).sort({ created_at: -1 }).limit(5).toArray(),
  ]);

  res.json({
    stats: {
      total_users: totalUsers,
      total_projects: totalProjects,
      total_shapes: totalShapes,
      total_imports: totalImports,
      total_beams: totalBeams,
      filled_beams: filledBeams,
      pending_ai_requests: pendingAiRequests,
    },
    recent_projects: recentProjects.map(toJson),
    recent_shapes: recentShapes.map(toJson),
  });
});

// GET /api/dashboard/user — stats scoped to req.user.email
router.get("/user", async (req, res) => {
  const email = req.user.email;

  const [totalProjects, pendingAiRequests, appliedAiRequests] = await Promise.all([
    projectsCollection.countDocuments({ created_by: email }),
    aiRequestsCollection.countDocuments({ requested_by: email, status: "pending" }),
    aiRequestsCollection.countDocuments({ requested_by: email, status: "applied" }),
  ]);

  res.json({
    stats: {
      total_projects: totalProjects,
      pending_ai_requests: pendingAiRequests,
      applied_ai_requests: appliedAiRequests,
    },
  });
});

export default router;
