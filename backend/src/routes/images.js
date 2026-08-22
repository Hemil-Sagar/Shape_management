const express = require('express')
const { getDb } = require('../db')
const { openImageDownloadStream } = require('../utils/gridfs')
const asyncHandler = require('../utils/asyncHandler')
const router = express.Router()
router.use((req, res, next) => {
  req.db = getDb()
  next()
})

router.get('/:fileId', asyncHandler(async (req, res) => {
  const result = await openImageDownloadStream(req.db, req.params.fileId)

  if (!result) {
    return res.status(404).json({ error: 'Image not found' })
  }
  res.set('Content-Type', result.file.contentType || result.file.metadata?.contentType || 'application/octet-stream')
  res.set('Cache-Control', 'public, max-age=86400')
  result.stream.on('error', () => {
    res.status(404).end()
  })

  result.stream.pipe(res)
}))

module.exports = router