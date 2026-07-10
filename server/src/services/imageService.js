import { gridfs, toObjectId } from "../db/index.js";

function safeFilenamePart(value) {
  const cleaned = (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "image";
}

function getFileExtension(filename, mimeType = "") {
  const fromName = /\.[a-zA-Z0-9]+$/.exec(filename || "");
  if (fromName) return fromName[0].toLowerCase();
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return ".jpg";
  if (mimeType.includes("webp")) return ".webp";
  return ".png";
}

/** uploadedFile: { buffer, originalname, mimetype } (multer memory storage file). */
export async function saveUploadedImageToMongodb(
  uploadedFile,
  { category = "beam", shapeName = "shape", uploadedBy = null, source = "shape_upload" } = {}
) {
  if (!uploadedFile) {
    return { image_file_id: null, image_filename: null, image_mime_type: null, image_storage: null };
  }

  const ext = getFileExtension(uploadedFile.originalname, uploadedFile.mimetype);
  const timestamp = `${Date.now()}${process.hrtime.bigint() % 1000n}`;
  const filename = `${safeFilenamePart(category)}_${safeFilenamePart(shapeName)}_${timestamp}${ext}`;

  const uploadStream = gridfs.openUploadStream(filename, {
    metadata: {
      category,
      shape_name: shapeName,
      uploaded_by: uploadedBy,
      source,
      original_filename: uploadedFile.originalname,
      created_at: new Date(),
    },
    contentType: uploadedFile.mimetype,
  });

  await new Promise((resolve, reject) => {
    uploadStream.end(uploadedFile.buffer, (error) => (error ? reject(error) : resolve()));
  });

  return {
    image_file_id: String(uploadStream.id),
    image_filename: filename,
    image_mime_type: uploadedFile.mimetype,
    image_storage: "mongodb_gridfs",
  };
}

export async function getMongodbImageBytes(imageFileId) {
  const oid = toObjectId(imageFileId);
  if (!oid) return null;

  const chunks = [];
  try {
    await new Promise((resolve, reject) => {
      gridfs
        .openDownloadStream(oid)
        .on("data", (chunk) => chunks.push(chunk))
        .on("error", reject)
        .on("end", resolve);
    });
  } catch {
    return null;
  }

  return Buffer.concat(chunks);
}

export async function getMongodbImageInfo(imageFileId) {
  const oid = toObjectId(imageFileId);
  if (!oid) return null;
  const files = await gridfs.find({ _id: oid }).toArray();
  return files[0] ?? null;
}

export async function deleteMongodbImage(imageFileId) {
  const oid = toObjectId(imageFileId);
  if (!oid) return false;
  try {
    await gridfs.delete(oid);
    return true;
  } catch {
    return false;
  }
}

export async function hasMongodbImage(imageFileId) {
  return (await getMongodbImageInfo(imageFileId)) !== null;
}

export function extractImageMetadataFromDocument(document) {
  return {
    image_file_id: document?.image_file_id ?? null,
    image_filename: document?.image_filename ?? null,
    image_mime_type: document?.image_mime_type ?? null,
    image_storage: document?.image_storage ?? null,
    image_path: document?.image_path ?? null,
  };
}
