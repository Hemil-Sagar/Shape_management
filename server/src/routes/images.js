import { Router } from "express";
import { getMongodbImageBytes, getMongodbImageInfo } from "../services/imageService.js";

const router = Router();

router.get("/:fileId", async (req, res) => {
  const info = await getMongodbImageInfo(req.params.fileId);
  if (!info) return res.status(404).json({ error: "Image not found." });

  const bytes = await getMongodbImageBytes(req.params.fileId);
  if (!bytes) return res.status(404).json({ error: "Image not found." });

  res.setHeader("Content-Type", info.contentType || "image/png");
  res.send(bytes);
});

export default router;
