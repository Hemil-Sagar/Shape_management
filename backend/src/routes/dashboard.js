const express = require("express")
const { getDb } = require("../db")
const { requireAuth, requireRole } = require("../middleware/auth")
const asynHandler = require("../utils/asyncHandler")
const asyncHandler = require("../utils/asyncHandler")

const router = express.Router()

router.get("/user", requireAuth, asynHandler(async (req, res) => {
  res.json({
    stats: {
      total_projects: 0,
      pending_projects: 0,
    }
  })
}))

router.get("/admin", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const db = getDb()
  const totalUsers = await db.collection("users").countDocuments()
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
        total_projects: 0,
        total_shapes: totalShapes,
        total_imports: 0,
        total_beams: 0, 
        filled_beams: 0, 
      },
      recent_projects: [],
      recent_shapes: recentShapes,
    })
  }))
module.exports = router