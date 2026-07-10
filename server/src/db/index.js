import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import { config } from "../config/env.js";

export const client = new MongoClient(config.mongoUri);
export const db = client.db(config.dbName);
export const gridfs = new GridFSBucket(db, { bucketName: "fs" });

export const usersCollection = db.collection("users");
export const projectsCollection = db.collection("projects");
export const blocksCollection = db.collection("blocks");
export const floorsCollection = db.collection("floors");
export const autocadImportsCollection = db.collection("autocad_imports");

export const shapeLibraryCollection = db.collection("shape_library");
export const customShapeLibraryCollection = db.collection("custom_shape_library");
export const beamsCollection = db.collection("beams");

export const aiRequestsCollection = db.collection("ai_requests");

export async function testConnection() {
  try {
    await client.db("admin").command({ ping: 1 });
    return true;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    return false;
  }
}

/** Safe ObjectId parse — returns null instead of throwing on invalid ids (mirrors Python's try/except pattern). */
export function toObjectId(id) {
  if (!id || !ObjectId.isValid(id)) return null;
  return new ObjectId(String(id));
}
