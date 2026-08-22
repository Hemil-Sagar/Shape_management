const express = require('express')
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { upload } = require('../utils/upload')
const asyncHandler = require('../utils/asyncHandler')
const { uploadImageBuffer } = require('../utils/gridfs')

const router = express.Router()
router.use((req, res, next) => {
  req.db = getDb()
  next()
})
router.use(requireAuth, requireRole('admin'))

const toShapeResponse = (doc) => {
  return {
    id: doc._id.toString(),
    shape_name: doc.shape_name,
    category: doc.category,
    user_email: doc.user_email || null,
    user_name: doc.user_name || null,
    description: doc.description || "",
    outputs: doc.outputs || [],
    image_file_id: doc.image_file_id || null,
    is_active: doc.is_active !== false,
    created_by: doc.created_by || null,
    updated_by: doc.updated_by || null,
    updated_at: doc.updated_at || null,
  }
}

const parseObjectId = (res, id) => {
  try {
    return new ObjectId(id)
  } catch {
    res.status(404).json({ error: 'Shape not found' })
    return null
  }
}

router.get("/", asyncHandler(async (req, res) => {
  const { category, searchText, statusFilter } = req.query

  const filter = {}
  if (category) {
    filter.category = category
  }
  if (searchText) {
    filter.shape_name = new RegExp(searchText, 'i')
  }
  if (statusFilter === 'Active') {
    filter.is_active = { $ne: false }
  }
  if (statusFilter === 'Inactive') {
    filter.is_active = false
  }

  const shapes = await req.db
    .collection('shapes')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray()

  res.json(shapes.map(toShapeResponse))
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const objectId = parseObjectId(res, req.params.id)
  if (!objectId) return

  const shape = await req.db.collection('shapes').findOne({ _id: objectId })

  if (!shape) {
    return res.status(404).json({ error: 'Shape not found' })
  }
  res.json(toShapeResponse(shape))
}))

router.post("/", upload.single("image"), asyncHandler(async (req, res) => {
  const { shape_name, category, user_email, user_name, outputs } = req.body

  if (!shape_name || !shape_name.trim()) {
    return res.status(400).json({ error: "Shape name is required." })
  }

  let parsedOutputs = []

  try {
    parsedOutputs = outputs ? JSON.parse(outputs) : []
  } catch {
    return res.status(400).json({ error: "Outputs must be valid JSON." })
  }

  const now = new Date()

  let imageFileId = null

  if (req.file) {
    imageFileId = await uploadImageBuffer(
      req.db,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    )
  }

  const newShape = {
    shape_name: shape_name.trim(),
    category,
    user_email: user_email || null,
    user_name: user_name || null,
    description: "",
    outputs: parsedOutputs,
    image_file_id: imageFileId,
    is_active: true,
    created_by: req.user.email,
    updated_by: req.user.email,
    createdAt: now,
    updated_at: now,
  }

  const result = await req.db.collection("shapes").insertOne(newShape)

  newShape._id = result.insertedId

  res.status(201).json(toShapeResponse(newShape))
}))

router.patch("/:id", upload.single("image"), asyncHandler(async (req, res) => {
  const { shape_name, category, description, user_email, user_name, outputs, is_active } = req.body

  const objectId = parseObjectId(res, req.params.id)
  if (!objectId) return

  let parsedOutputs = []
  try {
    parsedOutputs = outputs ? JSON.parse(outputs) : []
  } catch {
    return res.status(400).json({ error: "Outputs must be valid json" })
  }

  const update = {
    shape_name: shape_name?.trim(),
    category,
    description: description || "",
    user_email: user_email || null,
    user_name: user_name || null,
    outputs: parsedOutputs,
    is_active: is_active === "true",
    updated_by: req.user.email,
    updated_at: new Date(),
  }

  if (req.file) {
    update.image_file_id = await uploadImageBuffer(
      req.db,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    )
  }

  const updated = await req.db
    .collection("shapes")
    .findOneAndUpdate({ _id: objectId }, { $set: update }, { returnDocument: "after" })

  // mongodb driver v6 returns the document itself here, not { value: doc }
  if (!updated) {
    return res.status(404).json({ error: "Shape not found" })
  }
  res.json(toShapeResponse(updated))
}))

router.post("/:id/deactivate", asyncHandler(async (req, res) => {
  await setActiveState(req, res, false)
}))

router.post("/:id/reactivate", asyncHandler(async (req, res) => {
  await setActiveState(req, res, true)
}))

async function setActiveState(req, res, isActive) {
  const objectId = parseObjectId(res, req.params.id)
  if (!objectId) return

  const updated = await req.db.collection("shapes").findOneAndUpdate(
    { _id: objectId },
    { $set: { is_active: isActive, updated_by: req.user.email, updated_at: new Date() } },
    { returnDocument: "after" }
  )

  if (!updated) {
    return res.status(404).json({ error: "Shape not found" })
  }

  res.json(toShapeResponse(updated))
}

module.exports = router