const { getDb } = require('../../db')
const { NotFound } = require('@feathersjs/errors')

class DashboardService {
    constructor(options = {}, app) {
        this.options = options
        this.app = app
        this.db = getDb()
    }

    // GET /api/dashboard/admin
    // The only route this resource ever had. Mapped onto Feathers' get(id, params)
    // with id === 'admin' so the URL (/api/dashboard/admin) doesn't change.
    async get(id) {
        if (id !== 'admin') {
            throw new NotFound('Not found')
        }

        const totalUsers = await this.db.collection('users').countDocuments()
        const totalProjects = await this.db.collection('projects').countDocuments()

        const recentProjectsDocs = await this.db
            .collection('projects')
            .find({})
            .sort({ created_at: -1 })
            .limit(5)
            .toArray()

        const recentProjects = recentProjectsDocs.map((project) => ({
            id: project._id.toString(),
            project_name: project.project_name,
            project_code: project.project_code,
            created_by_name: project.created_by_name,
            status: project.status,
        }))

        const totalShapes = await this.db.collection('shapes').countDocuments()

        const recentShapesDocs = await this.db
            .collection('shapes')
            .find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray()

        const recentShapes = recentShapesDocs.map((shape) => ({
            id: shape._id.toString(),
            shape_name: shape.shape_name,
            category: shape.category,
            outputs: shape.outputs || [],
        }))

        return {
            stats: {
                total_users: totalUsers,
                total_projects: totalProjects,
                total_shapes: totalShapes,
                total_imports: 0,
                total_beams: 0,
                filled_beams: 0,
            },
            recent_projects: recentProjects,
            recent_shapes: recentShapes,
        }
    }
}

module.exports = { DashboardService }