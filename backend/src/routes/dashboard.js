const express = require("express")
const { getDb } = require("../db")
const { requireAuth, requireRole } = require("../middleware/auth")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.get("/admin", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const db = getDb()

  const totalUsers = await db.collection("users").countDocuments()
  const totalProjects = await db.collection("projects").countDocuments()

  const recentProjectsDocs = await db
    .collection("projects")
    .find({})
    .sort({ created_at: -1 })
    .limit(5)
    .toArray()

  const recentProjects = recentProjectsDocs.map((project) => ({
    id: project._id.toString(),
    project_name: project.project_name,
    project_code: project.project_code,
    created_by_name: project.created_by_name,
    status: project.status,
  }))

  const totalShapes = await db.collection("shapes").countDocuments()

  const recentShapesDocs = await db
    .collection("shapes")
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray()

  const recentShapes = recentShapesDocs.map((shape) => ({
    id: shape._id.toString(),
    shape_name: shape.shape_name,
    category: shape.category,
    outputs: shape.outputs || [],
  }))

  res.json({
    stats: {
      total_users: totalUsers,
      total_projects: totalProjects,
      total_shapes: totalShapes,
      total_imports: 0, 
      total_beams: 0, 
      filled_beams: 0, 
    },
    recent_projects: recentProjects,
    recent_shapes: recentShapes,
  })
}))

module.exports = router