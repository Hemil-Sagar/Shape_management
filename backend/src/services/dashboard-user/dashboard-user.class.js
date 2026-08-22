const {getDb} = require('../../db')
class DashBoardUserService{
  constructor(options = {}, app) {
    this.options = options
    this.app = app
    this.db = getDb()
  }
  async find(params) {

    const totalProjects = await this.db
      .collection('projects')
      .countDocuments({created_by: params.user.email})
    
    return {
      stats: {
        total_projects: totalProjects,
        pending_ai_requests: 0,
        appliend_ai_requests: 0,
      },
    }
  }
}
module.exports = { DashBoardUserService }