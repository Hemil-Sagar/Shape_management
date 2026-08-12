const express = require('express')
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')
const { requireAuth } = require('../middleware/auth')
const asyncHandler = require('../utils/asyncHandler')

const router = express.Router()
router.use(requireAuth)

const toCustomItemResponse = (doc) => {
  const isOverride = doc.type === "formula_override"

  let customization_type_label = "Custom Shape"

  if (doc.cloned_from) {
    customization_type_label = "Cloned from libaray"
  } else if (doc.cloned_from_custom) {
    customization_type_label = "Cloned from Another User"
  } else if (isOverride) {
    customization_type_label = "Custom Formula"
  }
  return {
    id: doc._id.toString(),
    type: doc.type,
    user_email: doc.user_email,
    user_name: doc.user_name,
    
    category: doc.category,  
    shape_name: doc.shape_name || null,
    description: doc.description || "",  
    outputs: doc.outputs || [],  
    image_file_id:doc.image_file_id || null,   
    cloned_from:doc.cloned_from || null,   
    cloned_from_name:doc.cloned_from_name || null,  
    cloned_from_custom:doc.cloned_from_custom || null,  
    is_active:doc.is_active !== false,   
    updated_by:doc.updated_by || null,  
    updated_at:doc.updated_at || null,  
    display_shape_name:doc.shape_name || null,  
    display_description:doc.description || "",   
    display_outputs:doc.outputs || [],   
    display_image_file_id:doc.image_file_id || null,   
    customization_type_label,

    project_name: null,
    request_code: null,
    requested_by: null,
    requested_by_name: null,

    base_shape_name: doc.cloned_from_name || null,
    override_outputs: doc.override_outputs || []
  }
}

const parseObjectId = (res, id) => {
  try {
    return new ObjectId(id)
  } catch {
    res.status(404).json({ error: 'Custom shape not found' })
    return null
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const {
      category,
      statusFilter,
    } = req.query

    const db = getDb()

    const filter = {}

    if (category) {
      filter.category = category
    }

    if (statusFilter === "Active") {
      filter.is_active = {
        $ne: false,
      };
    }

    if (statusFilter === "Inactive") {
      filter.is_active = false;
    }
    
    filter.user_email = req.user.email;

    const items = await db
      .collection("customShapes")
      .find(filter)
      .toArray()

    res.json(items.map(toCustomItemResponse))
  })
)

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const objectId = parseObjectId(
      res,
      req.params.id
    )

    if (!objectId) {
      return
    }

    const db = getDb()

    const item = await db
      .collection("customShapes")
      .findOne({
        _id: objectId,
      })

    if (!item) {
      return res.status(404).json({
        error: "Custom shape not found.",
      })
    }

    if (item.user_email !== req.user.email) {
      return res.status(403).json({
        error: "You don't have permission to view this.",
      })
    }
    res.json(toCustomItemResponse(item))
  })
)


module.exports = router