import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import imageRoutes from "./routes/images.js";
import projectRoutes from "./routes/projects.js";
import blockRoutes from "./routes/blocks.js";
import floorRoutes from "./routes/floors.js";
import autocadImportRoutes from "./routes/autocadImports.js";
import beamRoutes from "./routes/beams.js";
import shapeRoutes from "./routes/shapes.js";
import customShapeRoutes from "./routes/customShapes.js";
import aiRequestRoutes from "./routes/aiRequests.js";
import adminUserRoutes from "./routes/adminUsers.js";
import dashboardRoutes from "./routes/dashboard.js";
import aiChatRoutes from "./routes/aiChat.js";
import { requireAuth } from "./middleware/auth.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/images", imageRoutes); // GridFS-served images, no auth (mirrors original app.py's unauthenticated static asset behavior)

app.use("/api/projects", requireAuth, projectRoutes);
app.use("/api/blocks", requireAuth, blockRoutes);
app.use("/api/floors", requireAuth, floorRoutes);
app.use("/api/autocad-imports", requireAuth, autocadImportRoutes);
app.use("/api/beams", requireAuth, beamRoutes);
app.use("/api/shapes", requireAuth, shapeRoutes);
app.use("/api/custom-shapes", requireAuth, customShapeRoutes);
app.use("/api/ai-requests", requireAuth, aiRequestRoutes);
app.use("/api/admin/users", requireAuth, adminUserRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/ai/chat", requireAuth, aiChatRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ error: error.message || "Internal server error." });
});
