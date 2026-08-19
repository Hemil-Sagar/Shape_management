const { ObjectID } = require('mongodb')

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

async function getAvaibleShapesForProject(db, projectId, category = 'beam') {
  const availableShapes = []
  const ownerEmail = await getProjectOwnerEmail(db, projectId)

  const customShapes = await db
    .collection('custom_shapes')
    .find({ user_email: ownerEmail, type: 'custom_shape', category, is_active: { $ne: false } })
    .sort({ shape_name: 1 })
    .toArray()

  const clonedGlobalIds = new Set(customShapes.map((shape) => shape.cloned_from).filter(Boolean))
  const globalShapes = await db
  collection('shapes')
}