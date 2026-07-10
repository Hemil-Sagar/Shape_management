import { Router } from "express";
import { runFormulaUpdateAgent } from "../agent/langgraphAgent.js";
import { createAiRequest } from "../agent/requestService.js";

const router = Router();

// requireAuth is already applied by app.js when mounting this router at /api/ai/chat.

// POST /api/ai/chat — one turn of the Neev formula-update conversation.
router.post("/", async (req, res) => {
  const { conversationMessages, currentStructuredData } = req.body || {};

  try {
    const result = await runFormulaUpdateAgent({
      userEmail: req.user.email,
      conversationMessages: conversationMessages || [],
      currentStructuredData: currentStructuredData || {},
    });

    res.json(result);
  } catch (error) {
    console.error("AI chat agent error:", error);
    res.status(500).json({ error: "The AI assistant could not process that message. Please try again." });
  }
});

// POST /api/ai/chat/submit — submits a ready-to-submit formula_update structured_data
// payload as a pending AI request for admin review.
// Port of ui/ai_assistant.py::submit_ai_formula_update_request.
router.post("/submit", async (req, res) => {
  const data = req.body || {};

  try {
    const requestDoc = {
      request_type: "formula_update",

      requested_by: req.user.email,
      requested_by_name: req.user.name,

      project_id: data.project_id ?? null,
      project_name: data.project_name ?? null,

      category: data.category ?? null,

      shape_id: data.shape_id ?? null,
      shape_name: data.shape_name ?? null,

      output_name: data.output_name ?? null,
      current_formula: data.current_formula ?? null,
      requested_formula: data.requested_formula ?? null,

      reason: data.reason ?? null,
      ai_summary:
        `User requested formula update for ` +
        `${data.shape_name} - ${data.output_name} ` +
        `in project ${data.project_name}.`,
      ai_suggestion:
        "Admin should verify the requested formula. " +
        "If approved, it should be applied only to this project.",

      new_shape_payload: null,
      new_shape_image_path: null,

      status: "pending",
    };

    const { requestId, requestCode } = await createAiRequest(requestDoc);

    res.status(201).json({ requestId, requestCode });
  } catch (error) {
    console.error("AI request submission error:", error);
    res.status(500).json({ error: "Failed to submit request." });
  }
});

export default router;
