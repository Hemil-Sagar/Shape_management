const { ObjectId } = require('mongodb')
const { NotFound, Forbidden } = require('@feathersjs/errors')

async function assertProjectAccess(db, projectId, user) {
  let projectObjectId
  try {
    projectObjectId = new ObjectId(projectId)
  } catch {
    throw new NotFound('Project not found')
  }

  const project = await db.collection('projects').findOne({ _id: projectObjectId })
  if (!project) throw new NotFound('Project not found')

  if (user.role !== 'admin' && project.created_by !== user.email) {
    throw new Forbidden("You don't have permission to access this project.")
  }

  return project
}

module.exports = { assertProjectAccess }