const express = require('express')
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { upload } = require('../utils/upload')

const router = express.Router()
router.use(requireAuth, requireRole('admin'))

const toCustomItemResponse = (doc) => {
  const isOverride = doc.type === "formula_override"

  let customization_type_label = 'Custom shape'
  if (doc.cloned_from) customization_type_label = "cloned from library"
  else if(doc.cloned_from_custom) customization_type_label = "Cloned from another user"
  else if (isOverride) customization_type_label = "Custom formule"

  return {
    id: doc._id.toString(),
    type: doc.type,
    user_email: doc.user_email,
    user_name: doc.user_name,
    category: doc.category,
    shape_name: doc.shape_name || null,
    description: doc.description || "",
    outputs: doc.outputs || [],
    image_file_id: doc.image_file_id || null,
    cloned_from: doc.cloned_from || null,
    cloned_from_name: doc.cloned_from_name || null,
    cloned_from_custom: doc.cloned_from_custom || null,
    is_active: doc.is_active !== false,
    update_by: doc.update_by || null,
    update_at: doc.update_at || null,

    display_shape_name: doc.shape_name || null,
    display_description: doc.description || "",
    display_outputs: doc.outputs || [],
    display_image_file_id: doc.image_file_id || null,
    customization_type_label,

    project_name: null,
    respect_code: null,
    respect_by: null,
    respect_by_name: null,
    base_shape_name: doc.cloned_from_name || null,
    override_outputs: doc.override_outputs || null,
  }
}

const parseObjectId = (res, id) => {
  try {
    return new ObjectId(id)
  } catch {
    res.status(404).json({ error: "Custom shape not found" })
    return null
  }
}

router.get("/for-user", async (req, res) => {
  const { userEmail } = req.query
  if (!userEmail) return res.status(400).json({ error: "User email is required" })
  const db = getDb()
  const items = await db.collection("customShapes").find({ user_email: userEmail }).toArray()
  res.json(items.map(toCustomItemResponse))
})

router.get('/', async (req, res) => {
  const { category, statusFilter } = req.query
  const db = getDb()
  const filter = {}
  if (category) filter.category = category
  if (statusFilter === 'Active') filter.is_active = { $ne: false }
  if (statusFilter === 'Inactive') filter.is_active = false

  const items = await db.collection("customShapes").find(filter).toArray()
  res.json(items.map(toCustomItemResponse))
})

router.post('/user', upload.single('image'), async (req, res) => {
  const { user_email, user_name, category, shape_name, outputs } = req.body

  if (!user_email) return res.status(400).json({ error: "user_email is required." })
    if (!shape_name || !shape_name.trim()) {
      return res.status(400).json({ error: "Shape name is required." })
    }
  
    let parsedOutputs = []
    try {
      parsedOutputs = outputs ? JSON.parse(outputs) : []
    } catch {
      return res.status(400).json({ error: "Outputs must be valid JSON." })
    }
  
    const db = getDb()
    const now = new Date()
  
    const newItem = {
      type: "custom_shape",
      user_email,
      user_name: user_name || "",
      category,
      shape_name: shape_name.trim(),
      description: "",
      outputs: parsedOutputs,
      image_file_id: req.file ? req.file.filename : null,
      cloned_from: null,
      cloned_from_name: null,
      cloned_from_custom: null,
      is_active: true,
      updated_by: req.user.email,
      updated_at: now,
      createdAt: now,
    }
  
    const result = await db.collection("customShapes").insertOne(newItem)
    newItem._id = result.insertedId
  
    res.status(201).json(toCustomItemResponse(newItem))
  })
  
  // POST /api/custom-shapes/clone-from-global  (json: shape_id, user_email, user_name)
  // Copies a general library shape into a new custom shape scoped to one user.
  router.post("/clone-from-global", async (req, res) => {
    const { shape_id, user_email, user_name } = req.body
    const db = getDb()
  
    const shapeObjectId = parseObjectId(res, shape_id)
    if (!shapeObjectId) return
  
    const source = await db.collection("shapes").findOne({ _id: shapeObjectId })
    if (!source) return res.status(404).json({ error: "Shape not found." })
  
    const now = new Date()
    const clone = {
      type: "custom_shape",
      user_email,
      user_name: user_name || "",
      category: source.category,
      shape_name: source.shape_name,
      description: source.description || "",
      outputs: source.outputs || [],
      image_file_id: source.image_file_id || null,
      cloned_from: source._id.toString(),
      cloned_from_name: source.shape_name,
      cloned_from_custom: null,
      is_active: true,
      updated_by: req.user.email,
      updated_at: now,
      createdAt: now,
    }
  
    const result = await db.collection("customShapes").insertOne(clone)
    clone._id = result.insertedId
  
    res.status(201).json(toCustomItemResponse(clone))
  })
  
  // POST /api/custom-shapes/clone-from-custom  (json: custom_shape_id, user_email, user_name)
  // Copies another user's custom shape into a new one scoped to this user.
  router.post("/clone-from-custom", async (req, res) => {
    const { custom_shape_id, user_email, user_name } = req.body
    const db = getDb()
  
    const sourceObjectId = parseObjectId(res, custom_shape_id)
    if (!sourceObjectId) return
  
    const source = await db.collection("customShapes").findOne({ _id: sourceObjectId })
    if (!source) return res.status(404).json({ error: "Custom shape not found." })
  
    const now = new Date()
    const clone = {
      type: "custom_shape",
      user_email,
      user_name: user_name || "",
      category: source.category,
      shape_name: source.shape_name,
      description: source.description || "",
      outputs: source.outputs || [],
      image_file_id: source.image_file_id || null,
      cloned_from: null,
      cloned_from_name: null,
      cloned_from_custom: source._id.toString(),
      is_active: true,
      updated_by: req.user.email,
      updated_at: now,
      createdAt: now,
    }
  
    const result = await db.collection("customShapes").insertOne(clone)
    clone._id = result.insertedId
  
    res.status(201).json(toCustomItemResponse(clone))
  })
  
  // GET /api/custom-shapes/:id
  router.get("/:id", async (req, res) => {
    const objectId = parseObjectId(res, req.params.id)
    if (!objectId) return
  
    const db = getDb()
    const item = await db.collection("customShapes").findOne({ _id: objectId })
    if (!item) return res.status(404).json({ error: "Custom shape not found." })
  
    res.json(toCustomItemResponse(item))
  })
  
  // PATCH /api/custom-shapes/:id  (multipart/form-data: shape_name, description, outputs, is_active, image?)
  // Only valid for type "custom_shape".
  router.patch("/:id", upload.single("image"), async (req, res) => {
    const objectId = parseObjectId(res, req.params.id)
    if (!objectId) return
  
    const { shape_name, description, outputs, is_active } = req.body
  
    let parsedOutputs = []
    try {
      parsedOutputs = outputs ? JSON.parse(outputs) : []
    } catch {
      return res.status(400).json({ error: "Outputs must be valid JSON." })
    }
  
    const update = {
      shape_name: shape_name?.trim(),
      description: description || "",
      outputs: parsedOutputs,
      is_active: is_active === "true",
      updated_by: req.user.email,
      updated_at: new Date(),
    }
    if (req.file) update.image_file_id = req.file.filename
  
    const db = getDb()
    const result = await db
      .collection("customShapes")
      .findOneAndUpdate({ _id: objectId }, { $set: update }, { returnDocument: "after" })
  
    if (!result.value) return res.status(404).json({ error: "Custom shape not found." })
  
    res.json(toCustomItemResponse(result.value))
  })
  
  // PATCH /api/custom-shapes/:id/formula-override  (json: override_outputs, is_active)
  // Only valid for type "formula_override" - see the note at the top of this file.
  router.patch("/:id/formula-override", async (req, res) => {
    const objectId = parseObjectId(res, req.params.id)
    if (!objectId) return
  
    const { override_outputs, is_active } = req.body
  
    const db = getDb()
    const result = await db.collection("customShapes").findOneAndUpdate(
      { _id: objectId, type: "formula_override" },
      {
        $set: {
          override_outputs,
          outputs: override_outputs,
          is_active,
          updated_by: req.user.email,
          updated_at: new Date(),
        },
      },
      { returnDocument: "after" }
    )
  
    if (!result.value) return res.status(404).json({ error: "Custom formula not found." })
  
    res.json(toCustomItemResponse(result.value))
  })
  
  // POST /api/custom-shapes/:id/deactivate
  router.post("/:id/deactivate", async (req, res) => {
    await setActiveState(req, res, false)
  })
  
  // POST /api/custom-shapes/:id/reactivate
  router.post("/:id/reactivate", async (req, res) => {
    await setActiveState(req, res, true)
  })
  
  async function setActiveState(req, res, isActive) {
    const objectId = parseObjectId(res, req.params.id)
    if (!objectId) return
  
    const db = getDb()
    const result = await db.collection("customShapes").findOneAndUpdate(
      { _id: objectId },
      { $set: { is_active: isActive, updated_by: req.user.email, updated_at: new Date() } },
      { returnDocument: "after" }
    )
  
    if (!result.value) return res.status(404).json({ error: "Custom shape not found." })
  
    res.json(toCustomItemResponse(result.value))
  }
  
  // DELETE /api/custom-shapes/:id
  router.delete("/:id", async (req, res) => {
    const objectId = parseObjectId(res, req.params.id)
    if (!objectId) return
  
    const db = getDb()
    const result = await db.collection("customShapes").deleteOne({ _id: objectId })
  
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Custom shape not found." })
    }
  
    res.status(204).end()
  })
module.exports = router