const { MongoClient } = require("mongodb")
const env = require('../config/env')
let client = null
let db = null

async function connectDB() {
  client = new MongoClient(env.mongoUri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  })

  await client.connect()

  db = client.db()
  await db.command({ ping: 1 })

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