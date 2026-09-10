const { ObjectId } = require('mongodb')
const { getDb } = require('../../db')
const { NotFound, BadRequest } = require('@feathersjs/errors')
const { uploadImageBuffer } = require('../../utils/gridfs')

function toShapeResponse(doc) {
    return {
        id: doc._id.toString(),
        shape_name: doc.shape_name,
        category: doc.category,
        user_email: doc.user_email || null,
        user_name: doc.user_name || null,
        description: doc.description || '',
        outputs: doc.outputs || [],
        image_file_id: doc.image_file_id || null,
        is_active: doc.is_active !== false,
        created_by: doc.created_by || null,
        updated_by: doc.updated_by || null,
        updated_at: doc.updated_at || null,
    }
}

function parseObjectId(id) {
    try {
        return new ObjectId(id)
    } catch {
        throw new NotFound('Shape not found')
    }
}

class ShapesService {
    constructor(options = {}, app) {
        this.options = options
        this.app = app
        this.db = getDb()
    }

    // GET /api/shapes?category=&searchText=&statusFilter=
    async find(params) {
        const { category, searchText, statusFilter } = params.query || {}

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

        const shapes = await this.db
            .collection('shapes')
            .find(filter)
            .sort({ createdAt: -1 })
            .toArray()

        return shapes.map(toShapeResponse)
    }

    // GET /api/shapes/:id
    async get(id) {
        const objectId = parseObjectId(id)

        const shape = await this.db.collection('shapes').findOne({ _id: objectId })

        if (!shape) {
            throw new NotFound('Shape not found')
        }
        return toShapeResponse(shape)
    }

    // POST /api/shapes  (multipart: image file optional, field "image")
    async create(data, params) {
        const { shape_name, category, user_email, user_name, outputs } = data

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

        let imageFileId = null
        const file = params.file
        if (file) {
            imageFileId = await uploadImageBuffer(this.db, file.buffer, file.originalname, file.mimetype)
        }

        const newShape = {
            shape_name: shape_name.trim(),
            category,
            user_email: user_email || null,
            user_name: user_name || null,
            description: '',
            outputs: parsedOutputs,
            image_file_id: imageFileId,
            is_active: true,
            created_by: params.user.email,
            updated_by: params.user.email,
            createdAt: now,
            updated_at: now,
        }

        const result = await this.db.collection('shapes').insertOne(newShape)
        newShape._id = result.insertedId

        return toShapeResponse(newShape)
    }

    // PATCH /api/shapes/:id  (multipart: image file optional, field "image")
    async patch(id, data, params) {
        const { shape_name, category, description, user_email, user_name, outputs, is_active } = data

        const objectId = parseObjectId(id)

        let parsedOutputs = []
        try {
            parsedOutputs = outputs ? JSON.parse(outputs) : []
        } catch {
            throw new BadRequest('Outputs must be valid json')
        }

        const update = {
            shape_name: shape_name?.trim(),
            category,
            description: description || '',
            user_email: user_email || null,
            user_name: user_name || null,
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
            .collection('shapes')
            .findOneAndUpdate({ _id: objectId }, { $set: update }, { returnDocument: 'after' })

        if (!updated) {
            throw new NotFound('Shape not found')
        }
        return toShapeResponse(updated)
    }

    // POST /api/shapes/:id/deactivate
    async deactivate(id, params) {
        return this._setActiveState(id, params, false)
    }

    // POST /api/shapes/:id/reactivate
    async reactivate(id, params) {
        return this._setActiveState(id, params, true)
    }

    async _setActiveState(id, params, isActive) {
        const objectId = parseObjectId(id)

        const updated = await this.db.collection('shapes').findOneAndUpdate(
            { _id: objectId },
            { $set: { is_active: isActive, updated_by: params.user.email, updated_at: new Date() } },
            { returnDocument: 'after' }
        )

        if (!updated) {
            throw new NotFound('Shape not found')
        }

        return toShapeResponse(updated)
    }
}

module.exports = { ShapesService }