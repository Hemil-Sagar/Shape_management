const { ObjectId } = require('mongodb') 
const { getDb } = require('../../db') 
const { NotFound, Forbidden, BadRequest } = require('@feathersjs/errors') 

function toImportResponse(doc) {
  return {
    id: doc._id.toString(),
    name: doc.import_name,
    project_id: doc.project_id,
    project_code: doc.project_code || '',
    block_id: doc.block_id || '',
    block_name: doc.block_name || '',
    floor_id: doc.floor_id || '',
    floor_name: doc.floor_name || '',
    drawing_number: doc.drawing_number || '',
    structure_name: doc.structure_name || '',
    status: doc.status || 'Pending',
    imported_by: doc.imported_by,
    imported_by_name: doc.imported_by_name,
    imported_at: doc.imported_at,
    created_at: doc.created_at,
    updated_at: doc.updated_at || null,
  } 
}

class AutocadImportsService {
  constructor(options = {}, app) {
    this.options = options 
    this.app = app
    this.db = getDb()
  }

  async find(params) { 
    const { projectId, searchText, statusFilter } = params.query || {} 

    const filter = {} 

    if (projectId) {
      filter.project_id = projectId 
    }

    if (params.user.role !== 'admin') {
      filter.imported_by = params.user.email 
    }

    if (searchText) {
      filter.import_name = new RegExp(searchText, 'i') 
    }
    if (statusFilter && statusFilter !== 'All') {
      filter.status = statusFilter 
    }

    const imports = await this.db
      .collection('autocad_imports')
      .find(filter)
      .sort({ created_at: -1 })
      .toArray() 

    return imports.map(toImportResponse) 
  }

  async get(id, params) {

    let objectId 
    try {
      objectId = new ObjectId(id) 
    } catch {
      throw new NotFound('AutoCAD import not found') 
    }

    const importItem = await this.db
      .collection('autocad_imports')
      .findOne({ _id: objectId }) 

    if (!importItem) {
      throw new NotFound('AutoCAD import not found') 
    }

    if (params.user.role !== 'admin' && importItem.imported_by !== params.user.email) {
      throw new Forbidden('You do not have permission to view this import') 
    }

    return toImportResponse(importItem) 
  }

  async create(data, params) {
    const {
      project_id,
      project_code,
      import_name,
      block_id,
      block_name,
      floor_id,
      floor_name,
      drawing_number,
      structure_name,
    } = data 

    if (!import_name || !import_name.trim()) {
      throw new BadRequest('import_name is required') 
    }

    if (!project_id) {
      throw new BadRequest('project_id is required') 
    }

    if (!floor_id) {
      throw new BadRequest('floor_id is required — please select a floor') 
    }

    const now = new Date() 

    const newImport = {
      project_id: project_id,
      project_code: project_code || '',
      import_name: import_name.trim(),
      block_id: block_id || '',
      block_name: block_name || '',
      floor_id: floor_id || '',
      floor_name: floor_name || '',
      drawing_number: (drawing_number || '').trim(),
      structure_name: (structure_name || '').trim(),
      status: 'Pending',
      imported_by: params.user.email,
      imported_by_name: params.user.name,
      imported_at: now,
      created_at: now,
      updated_at: now,
    } 

    const result = await this.db.collection('autocad_imports').insertOne(newImport) 

    newImport._id = result.insertedId 

    return toImportResponse(newImport) 
  }
  async patch(id, data, params) {

    let objectId 
    try {
      objectId = new ObjectId(id) 
    } catch {
      throw new NotFound('AutoCAD import not found') 
    }

    const existing = await this.db
      .collection('autocad_imports')
      .findOne({ _id: objectId }) 

    if (!existing) {
      throw new NotFound('AutoCAD import not found') 
    }

    if (params.user.role !== 'admin' && existing.imported_by !== params.user.email) {
      throw new Forbidden('You do not have permission to edit this import')
    }

    const update = { ...data, updated_at: new Date() }
    delete update.id
    delete update._id

    const updated = await this.db
      .collection('autocad_imports')
      .findOneAndUpdate(
        { _id: objectId },
        { $set: update },
        { returnDocument: 'after' }
      )

    return toImportResponse(updated)
  }

  async remove(id, params) {

    let objectId
    try {
      objectId = new ObjectId(id)
    } catch {
      throw new NotFound('AutoCAD import not found')
    }

    const existing = await this.db
      .collection('autocad_imports')
      .findOne({ _id: objectId })

    if (!existing) {
      throw new NotFound('AutoCAD import not found')
    }

    if (params.user.role !== 'admin' && existing.imported_by !== params.user.email) {
      throw new Forbidden('You do not have permission to delete this import')
    }

    await this.db.collection('autocad_imports').deleteOne({ _id: objectId })

    return toImportResponse(existing)
  }
}
module.exports = { AutocadImportsService }