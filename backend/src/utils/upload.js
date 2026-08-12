const multer = require('multer')
const path = require('path')

const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads")
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR)
  },
  filename: (req, file, cb) => {
    uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const extension = path.extname(file.originalname)
    cb(null,`${uniqueSuffix}${extension}`)
  },
})

const fileFilter = (req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "application/pdf"]
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error("Only png, jpg, jpeg and pdf images are allowed"))
  }
}

const upload = multer({
  storage, fileFilter, limits: {
    fileSize: 10*1024*1024,
  }
})

module.exports = { upload, UPLOADS_DIR }
