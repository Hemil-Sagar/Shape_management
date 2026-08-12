const { getDb } = require("../db")

async function getNextUserId(role) {
  const db = getDb()
  const counterId = role === "admin" ? "admin" : "user"

  const result = await db.collection("counters").findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  )
  return result.seq
}
module.exports = { getNextUserId }