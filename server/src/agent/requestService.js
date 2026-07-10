import { ObjectId } from "mongodb";
import { aiRequestsCollection } from "../db/index.js";

/**
 * Port of agent/request_service.py::create_ai_request.
 * Precomputes the _id so request_code can be set in a single insert
 * (avoids the original's insert-then-update two-write pattern).
 */
export async function createAiRequest(requestData) {
  const id = new ObjectId();
  const requestCode = `AIR-${id.toHexString().slice(-6).toUpperCase()}`;

  const document = {
    ...requestData,
    _id: id,
    request_code: requestCode,
    created_at: new Date(),
    updated_at: new Date(),
  };

  await aiRequestsCollection.insertOne(document);

  return { requestId: id.toHexString(), requestCode };
}

/** Port of agent/request_service.py::get_pending_ai_requests. */
export async function getPendingAiRequests() {
  return aiRequestsCollection.find({ status: "pending" }).sort({ created_at: -1 }).toArray();
}
