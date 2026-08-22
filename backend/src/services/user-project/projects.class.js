const { ObjectId } = require('mongodb')
const { getDb } = require('../../db')
const { NotFound, Forbidden, BadRequest } = require('@feathersjs/errors')

function toProjectResponse(doc) {
  return {
    id: doc._id.toString(),
    project_code: doc.project_code,
    project_name: doc.project_name,
    description: doc.description || '',
    start_date: doc.start_date,
    end_date: doc.end_date,
    created_by: doc.created_by,
    created_by_name: doc.created_by_name,
    created_at: doc.created_at,
    updated_at: doc.updated_at || null,
    status: doc.status,
  }
}

class ProjectsService {
  constructor(options = {}, app) {
    this.options = options
    this.app = app
    this.db = getDb()
  }

  async find(params) {
    const { searchText } = params.query || {}
    const filter = {}
    if (params.user.role !== 'admin') {
      filter.created_by = params.user.email
    }
    if (searchText) {
      filter.project_name = new RegExp(searchText, 'i')
    }
    const projects = await this.db
      .collection('projects')
      .find(filter)
      .sort({ created_at: -1 })
      .toArray()
    return projects.map(toProjectResponse)
  }

  async get(id, params) {
    let objectId
    try {
      objectId = new ObjectId(id)
    } catch {
      throw new NotFound('Project not found')
    }
    const project = await this.db.collection('projects').findOne({ _id: objectId })
    if (!project) throw new NotFound('Project not found')
    if (params.user.role !== 'admin' && project.created_by !== params.user.email) {
      throw new Forbidden('You do not have permission to view this')
    }
    return toProjectResponse(project)
  }

  async create(data, params) {
    const { project_name, description, start_date, end_date } = data
    if (!project_name || !start_date || !end_date) {
      throw new BadRequest('project_name, start_date and end_date are required')
    }
    const existingCount = await this.db.collection('projects').countDocuments()
    const project_code = 'PROJ' + String(existingCount + 1).padStart(4, '0')
    const now = new Date()
    const newProject = {
      project_code,
      project_name,
      description: description || '',
      start_date,
      end_date,
      created_by: params.user.email,
      created_by_name: params.user.name,
      created_at: now,
      updated_at: now,
      status: 'Active',
    }
    const result = await this.db.collection('projects').insertOne(newProject)
    newProject._id = result.insertedId
    return toProjectResponse(newProject)
  }

  async patch(id, data, params) {
  
    let objectId
    try {
      objectId = new ObjectId(id)
    } catch {
      throw new NotFound('Project not found')
    }
    const existing = await this.db.collection('projects').findOne({ _id: objectId })
    if (!existing) throw new NotFound('Project not found')
    if (params.user.role !== 'admin' && existing.created_by !== params.user.email) {
      throw new Forbidden('You do not have access to edit')
    }
    const update = { ...data, updated_at: new Date() }
    delete update.id
    delete update._id

    const updated = await this.db
      .collection('projects')
      .findOneAndUpdate({ _id: objectId }, { $set: update }, { returnDocument: 'after' })

    return toProjectResponse(updated)
  }
}

module.exports = { ProjectsService }