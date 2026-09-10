const { ObjectId } = require('mongodb')
const { getDb } = require('../../db')
const { NotFound, BadRequest } = require('@feathersjs/errors')
const { uploadImageBuffer } = require('../../utils/gridfs')

function toCustomItemResponse(doc) {
    const isOverride = doc.type === 'formula_override'

    let customization_type_label = 'Custom shape'
    if (doc.cloned_from) customization_type_label = 'cloned from library'
    else if (doc.cloned_from_custom) customization_type_label = 'Cloned from another user'
    else if (isOverride) customization_type_label = 'Custom formule'

    return {
        id: doc._id.toString(),
        type: doc.type,
        user_email: doc.user_email,
        user_name: doc.user_name,
        category: doc.category,
        shape_name: doc.shape_name || null,
        description: doc.description || '',
        outputs: doc.outputs || [],
        image_file_id: doc.image_file_id || null,
        cloned_from: doc.cloned_from || null,
        cloned_from_name: doc.cloned_from_name || null,
        cloned_from_custom: doc.cloned_from_custom || null,
        is_active: doc.is_active !== false,
        updated_by: doc.updated_by || null,
        updated_at: doc.updated_at || null,

        display_shape_name: doc.shape_name || null,
        display_description: doc.description || '',
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

function parseObjectId(id, message = 'Custom shape not found') {
    try {
        return new ObjectId(id)
    } catch {
        throw new NotFound(message)
    }
}

class AdminCustomShapesService {
    constructor(options = {}, app) {
        this.options = options
        this.app = app
        this.db = getDb()
    }

    // GET /api/custom-shapes?category=&statusFilter=
    async find(params) {
        const { category, statusFilter } = params.query || {}

        const filter = {}
        if (category) filter.category = category
        if (statusFilter === 'Active') filter.is_active = { $ne: false }
        if (statusFilter === 'Inactive') filter.is_active = false

        const items = await this.db.collection('customShapes').find(filter).toArray()
        return items.map(toCustomItemResponse)
    }

    // GET /api/custom-shapes/:id
    async get(id) {
        const objectId = parseObjectId(id, 'Custom shape not found.')

        const item = await this.db.collection('customShapes').findOne({ _id: objectId })
        if (!item) throw new NotFound('Custom shape not found.')

        return toCustomItemResponse(item)
    }

    // PATCH /api/custom-shapes/:id  (multipart: image file optional, field "image")
    async patch(id, data, params) {
        const objectId = parseObjectId(id, 'Custom shape not found.')

        const { shape_name, description, outputs, is_active } = data

        let parsedOutputs = []
        try {
            parsedOutputs = outputs ? JSON.parse(outputs) : []
        } catch {
            throw new BadRequest('Outputs must be valid JSON.')
        }

        const update = {
            shape_name: shape_name?.trim(),
            description: description || '',
            outputs: parsedOutputs,
            is_active: is_active === 'true',
            updated_by: params.user.email,
            updated_at: new Date(),
        }

        const file = params.file
        if (file) {
            update.image_file_id = await uploadImageBuffer(this.db, file.buffer, file.originalname, file.mimetype)
        }

        const updated = await this.db
            .collection('customShapes')
            .findOneAndUpdate({ _id: objectId }, { $set: update }, { returnDocument: 'after' })

        if (!updated) throw new NotFound('Custom shape not found.')

        return toCustomItemResponse(updated)
    }

    // DELETE /api/custom-shapes/:id
    async remove(id) {
        const objectId = parseObjectId(id, 'Custom shape not found.')

        const result = await this.db.collection('customShapes').deleteOne({ _id: objectId })
        if (result.deletedCount === 0) {
            throw new NotFound('Custom shape not found.')
        }
        // Route originally returned 204 with no body; handled in admin-custom-shapes.routes.js.
        return null
    }

    // GET /api/custom-shapes/for-user?userEmail=
    async getForUser(params) {
        const { userEmail } = params.query || {}
        if (!userEmail) throw new BadRequest('User email is required')

        const items = await this.db.collection('customShapes').find({ user_email: userEmail }).toArray()
        return items.map(toCustomItemResponse)
    }

    // POST /api/custom-shapes/user  (multipart: image file optional, field "image")
    async createForUser(data, params) {
        const { user_email, user_name, category, shape_name, outputs } = data

        if (!user_email) throw new BadRequest('user_email is required.')
        if (!shape_name || !shape_name.trim()) {
            throw new BadRequest('Shape name is required.')
        }

        let parsedOutputs = []
        try {
            parsedOutputs = outputs ? JSON.parse(outputs) : []
        } catch {
            throw new BadRequest('Outputs must be valid JSON.')
        }

        const now = new Date()
        const file = params.file
        const imageFileId = file
            ? await uploadImageBuffer(this.db, file.buffer, file.originalname, file.mimetype)
            : null

        const newItem = {
            type: 'custom_shape',
            user_email,
            user_name: user_name || '',
            category,
            shape_name: shape_name.trim(),
            description: '',
            outputs: parsedOutputs,
            image_file_id: imageFileId,
            cloned_from: null,
            cloned_from_name: null,
            cloned_from_custom: null,
            is_active: true,
            updated_by: params.user.email,
            updated_at: now,
            createdAt: now,
        }

        const result = await this.db.collection('customShapes').insertOne(newItem)
        newItem._id = result.insertedId

        return toCustomItemResponse(newItem)
    }

    // POST /api/custom-shapes/clone-from-global  (json: shape_id, user_email, user_name)
    // Copies a general library shape into a new custom shape scoped to one user.
    async cloneFromGlobal(data, params) {
        const { shape_id, user_email, user_name } = data

        const shapeObjectId = parseObjectId(shape_id, 'Shape not found.')

        const source = await this.db.collection('shapes').findOne({ _id: shapeObjectId })
        if (!source) throw new NotFound('Shape not found.')

        const now = new Date()
        const clone = {
            type: 'custom_shape',
            user_email,
            user_name: user_name || '',
            category: source.category,
            shape_name: source.shape_name,
            description: source.description || '',
            outputs: source.outputs || [],
            image_file_id: source.image_file_id || null,
            cloned_from: source._id.toString(),
            cloned_from_name: source.shape_name,
            cloned_from_custom: null,
            is_active: true,
            updated_by: params.user.email,
            updated_at: now,
            createdAt: now,
        }

        const result = await this.db.collection('customShapes').insertOne(clone)
        clone._id = result.insertedId

        return toCustomItemResponse(clone)
    }

    // POST /api/custom-shapes/clone-from-custom  (json: custom_shape_id, user_email, user_name)
    async cloneFromCustom(data, params) {
        const { custom_shape_id, user_email, user_name } = data

        const sourceObjectId = parseObjectId(custom_shape_id, 'Custom shape not found.')

        const source = await this.db.collection('customShapes').findOne({ _id: sourceObjectId })
        if (!source) throw new NotFound('Custom shape not found.')

        const now = new Date()
        const clone = {
            type: 'custom_shape',
            user_email,
            user_name: user_name || '',
            category: source.category,
            shape_name: source.shape_name,
            description: source.description || '',
            outputs: source.outputs || [],
            image_file_id: source.image_file_id || null,
            cloned_from: null,
            cloned_from_name: null,
            cloned_from_custom: source._id.toString(),
            is_active: true,
            updated_by: params.user.email,
            updated_at: now,
            createdAt: now,
        }

        const result = await this.db.collection('customShapes').insertOne(clone)
        clone._id = result.insertedId

        return toCustomItemResponse(clone)
    }

    // PATCH /api/custom-shapes/:id/formula-override
    async formulaOverride(id, data, params) {
        const objectId = parseObjectId(id, 'Custom formula not found.')

        const { override_outputs, is_active } = data

        const updated = await this.db.collection('customShapes').findOneAndUpdate(
            { _id: objectId, type: 'formula_override' },
            {
                $set: {
                    override_outputs,
                    outputs: override_outputs,
                    is_active,
                    updated_by: params.user.email,
                    updated_at: new Date(),
                },
            },
            { returnDocument: 'after' }
        )

        if (!updated) throw new NotFound('Custom formula not found.')

        return toCustomItemResponse(updated)
    }

    // POST /api/custom-shapes/:id/deactivate
    async deactivate(id, params) {
        return this._setActiveState(id, params, false)
    }

    // POST /api/custom-shapes/:id/reactivate
    async reactivate(id, params) {
        return this._setActiveState(id, params, true)
    }

    async _setActiveState(id, params, isActive) {
        const objectId = parseObjectId(id, 'Custom shape not found.')

        const updated = await this.db.collection('customShapes').findOneAndUpdate(
            { _id: objectId },
            { $set: { is_active: isActive, updated_by: params.user.email, updated_at: new Date() } },
            { returnDocument: 'after' }
        )

        if (!updated) throw new NotFound('Custom shape not found.')

        return toCustomItemResponse(updated)
    }
}

module.exports = { AdminCustomShapesService }