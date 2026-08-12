const { verifyToken } = require("../utils/auth")
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: "Not logged in" })
  }
  try {
    req.user = verifyToken(token)
    next()
  } catch (err) {
    return res.status(401).json({ error: "Session expired" })
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({error: "You do not have permission"})
    }
    next()
  }
}
module.exports = { requireAuth, requireRole }