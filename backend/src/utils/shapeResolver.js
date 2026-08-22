const { ObjectId } = require('mongodb')

async function getProjectOwnerEmail(db, projectId) {
  if (!projectId) return null
  let objectId
  try {
    objectId = new ObjectId(projectId)
  } catch {
    return null
  }
  const project = await db.collection('projects').findOne({ _id: objectId })
  return project ? project.created_by : null
}

function globalShapeVisibilityFilter(ownerEmail) {
  return {
    $or: [
      { user_email: null },
      { user_email: { $exists: false } },
      { user_email: ownerEmail },
    ],
  }
}

function isGlobalShapeVisibleToUser(shape, userEmail) {
  const assignedTo = shape.user_email
  if (!assignedTo) return true
  return assignedTo === userEmail
}

async function getAvailableShapesForProject(db, projectId, category = 'beam') {
  const availableShapes = []
  const ownerEmail = await getProjectOwnerEmail(db, projectId)

  const customShapes = await db
    .collection('customShapes')
    .find({ user_email: ownerEmail, type: 'custom_shape', category, is_active: { $ne: false } })
    .sort({ shape_name: 1 })
    .toArray()

  const clonedGlobalIds = new Set(customShapes.map((shape) => shape.cloned_from).filter(Boolean))

  const globalShapes = await db
    .collection('shapes')
    .find({ category, is_active: { $ne: false }, ...globalShapeVisibilityFilter(ownerEmail) })
    .sort({ shape_name: 1 })
    .toArray()

  for (const shape of globalShapes) {
    const shapeId = shape._id.toString()
    if (clonedGlobalIds.has(shapeId)) continue

    const overrideExists = await db.collection('customShapes').findOne({
      project_id: projectId, type: 'formula_override', base_shape_id: shapeId, is_active: { $ne: false },
    })

    let label = shape.shape_name || 'Untitled shape'
    if (overrideExists) label = `${label} (project formula available)`

    availableShapes.push({
      option_label: label,
      option_key: `global:${shapeId}`,
      shape_id: shapeId,
      shape_name: shape.shape_name,
      shape_source: 'global',
    })
  }

  for (const shape of customShapes) {
    const customShapeId = shape._id.toString()
    availableShapes.push({
      option_label: `${shape.shape_name || 'Custom Shape'} (Custom shape)`,
      option_key: `custom:${customShapeId}`,
      shape_id: customShapeId,
      shape_name: shape.shape_name,
      shape_source: 'custom',
    })
  }

  return availableShapes
}

async function resolveShapeForProject(db, projectId, selectedShapeKey = null, shapeId = null) {
  let source, selectedId

  if (selectedShapeKey) {
    ;[source, selectedId] = selectedShapeKey.split(':')
  } else {
    source = 'global'
    selectedId = shapeId
  }

  if (source === 'custom') {
    let objectId
    try {
      objectId = new ObjectId(selectedId)
    } catch {
      return null
    }

    const ownerEmail = await getProjectOwnerEmail(db, projectId)
    const customShape = await db.collection('customShapes').findOne({
      _id: objectId, user_email: ownerEmail, type: 'custom_shape', is_active: { $ne: false },
    })
    if (!customShape) return null

    const resolvedShape = { ...customShape }
    resolvedShape.shape_source = 'custom'
    resolvedShape.shape_id = customShape._id.toString()
    resolvedShape.custom_shape_id = customShape._id.toString()
    resolvedShape.base_shape_id = null
    resolvedShape.outputs = (customShape.outputs || []).map((output) => ({ ...output, formula_source: 'project_custom_shape' }))

    return resolvedShape
  }

  let globalObjectId
  try {
    globalObjectId = new ObjectId(selectedId)
  } catch {
    return null
  }

  const globalShape = await db.collection('shapes').findOne({ _id: globalObjectId })
  if (!globalShape) return null

  const ownerEmail = await getProjectOwnerEmail(db, projectId)
  if (!isGlobalShapeVisibleToUser(globalShape, ownerEmail)) return null

  const resolvedShape = { ...globalShape }
  resolvedShape.shape_source = 'global'
  resolvedShape.shape_id = globalShape._id.toString()
  resolvedShape.base_shape_id = globalShape._id.toString()
  resolvedShape.custom_shape_id = null

  const overrideDoc = await db.collection('customShapes').findOne({
    project_id: projectId, type: 'formula_override', base_shape_id: globalShape._id.toString(), is_active: { $ne: false },
  })

  const overrideOutputsByName = {}
  if (overrideDoc) {
    for (const output of overrideDoc.override_outputs || []) {
      overrideOutputsByName[(output.output_name || '').toLowerCase()] = output
    }
  }

  resolvedShape.outputs = (globalShape.outputs || []).map((output) => {
    const merged = { ...output }
    const key = (output.output_name || '').toLowerCase()

    if (overrideOutputsByName[key]) {
      const override = overrideOutputsByName[key]
      merged.formula = override.formula
      merged.unit = override.unit || output.unit || 'm'
      merged.formula_source = 'project_custom'
      merged.ai_request_id = override.ai_request_id
    } else {
      merged.formula_source = 'global'
    }

    return merged
  })

  return resolvedShape
}

module.exports = { getAvailableShapesForProject, resolveShapeForProject }