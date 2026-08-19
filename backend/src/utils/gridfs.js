const { GridFSBucket, ObjectId } = require('mongodb')

const getImageBucket = (db) => {
  return new GridFSBucket(db, {
    bucketName: 'images'
  })
}

const uploadImageBuffer = (db, buffer, filename, mimetype) => {
  return new Promise((resolve, reject) => {
    const bucket = getImageBucket(db)

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimetype,
      metadata: { contentType: mimetype },
    })

    uploadStream.on('error', reject)

    uploadStream.on('finish', () => {
      resolve(uploadStream.id.toString())
    })

    uploadStream.end(buffer)
  })
}

async function openImageDownloadStream(db, fileId) {
  const bucket = getImageBucket(db)

  let objectId

  try {
    objectId = new ObjectId(fileId)
  } catch {
    return null
  }

  const matchingFiles = await bucket
    .find({ _id: objectId })
    .toArray()

  if (matchingFiles.length === 0) {
    return null
  }

  return {
    stream: bucket.openDownloadStream(objectId),
    file: matchingFiles[0]
  }
}

module.exports = { getImageBucket, uploadImageBuffer, openImageDownloadStream }
