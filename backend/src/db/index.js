const { MongoClient } = require("mongodb")
const env = require('../config/env')
let db = null

async function connectDB() {
  const client = await MongoClient.connect(env.mongoUri)
  db = client.db()
  console.log("Database connected")

  // user number
  await db.collection("counters").updateOne(
    { _id: "user" },
    { $setOnInsert: { seq: 0 } },
    {upsert: true}
  )
  // admin number
  await db.collection("counters").updateOne(
    { _id: "admin" },
    { $setOnInsert: { seq: 400 } },
    { upsert: true }
  )
  return db
}

const getDb = () => {
  if (!db) {
    throw new Error("Database not connected")
  }
  return db
}
module.exports = {connectDB, getDb}