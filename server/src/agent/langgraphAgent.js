import { SYSTEM_PROMPT } from "./prompts.js";
import { callLlm, extractJsonFromText } from "./llmClient.js";
import { validateFormulaUpdateRequest } from "./validators.js";
import { findUserProjects, listActiveShapes } from "./tools.js";
import { ABBREVIATION_DICTIONARY } from "../utils/abbreviationTool.js";

// This module is a plain async pipeline, not a graph-framework state machine.
// The original Python used LangGraph, but the graph has no tool-calling —
// just 5 deterministic nodes with conditional routing — so it is reimplemented
// here as ordinary sequential function calls (see AGENT_NOTES.md).

export const NEW_SHAPE_BLOCKED_MESSAGE =
  "New shapes can only be added by your admin. " +
  "Please contact your admin to get a shape added for your account.";

/** Port of agent/langgraph_agent.py::merge_structured_data. */
export function mergeStructuredData(oldData, newData) {
  const merged = { ...oldData };

  for (const [key, value] of Object.entries(newData || {})) {
    const isEmpty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
    if (!isEmpty) {
      merged[key] = value;
    }
  }

  if (!merged.category) {
    merged.category = "beam";
  }

  return merged;
}

function normalizeText(text) {
  return (text || "").toLowerCase().trim();
}

function getFullUserText(conversationMessages) {
  return (conversationMessages || [])
    .filter((message) => message.role === "user")
    .map((message) => message.content || "")
    .join(" ");
}

function getLatestUserText(conversationMessages) {
  const messages = conversationMessages || [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content || "";
    }
  }
  return "";
}

/** Python str.title() equivalent: capitalize first letter of each word, lowercase the rest. */
function toTitleCase(text) {
  return text.replace(/[A-Za-z0-9]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/** Port of agent/langgraph_agent.py::improve_extraction_with_context. */
export function improveExtractionWithContext(data, context, conversationMessages) {
  const improved = { ...data };

  const fullUserText = getFullUserText(conversationMessages);
  const normalizedFullText = normalizeText(fullUserText);

  if (!improved.project_name) {
    for (const projectName of context.user_projects || []) {
      if (projectName && normalizedFullText.includes(normalizeText(projectName))) {
        improved.project_name = projectName;
        break;
      }
    }
  }

  if (!improved.shape_name) {
    for (const shape of context.available_shapes || []) {
      const shapeName = shape.shape_name;
      if (shapeName && normalizedFullText.includes(normalizeText(shapeName))) {
        improved.shape_name = shapeName;
        improved.category = shape.category || "beam";
        break;
      }
    }
  }

  if (!improved.output_name) {
    const outputMatch = fullUserText.match(/\bL[1-6]\b/i);
    if (outputMatch) {
      improved.output_name = outputMatch[0].toUpperCase();
    }
  }

  if (!improved.reason) {
    const reasonPatterns = [
      /\bbecause\b\s+(.*?)(?:\.?\s*(?:the\s+)?new formula|$)/i,
      /\bas per\b\s+(.*?)(?:\.?\s*(?:the\s+)?new formula|$)/i,
      /\bfor\b\s+(correction|site requirement|updated bend allowance).*?$/i,
    ];

    for (const pattern of reasonPatterns) {
      const match = fullUserText.match(pattern);
      if (match) {
        const reason = match[1].trim();
        if (reason) {
          improved.reason = reason;
          break;
        }
      }
    }
  }

  if (!improved.category) {
    improved.category = "beam";
  }

  return improved;
}

/** Port of agent/langgraph_agent.py::determine_intent. */
export function determineIntent(parsedIntent, mergedData, conversationMessages) {
  const fullText = getFullUserText(conversationMessages).toLowerCase();

  const newShapeKeywords = [
    "new shape",
    "add shape",
    "create shape",
    "custom shape",
    "request shape",
    "shape request",
  ];

  const formulaKeywords = [
    "update formula",
    "change formula",
    "formula update",
    "new formula",
    "requested formula",
  ];

  if (parsedIntent === "new_shape") {
    return "new_shape_blocked";
  }

  if (newShapeKeywords.some((keyword) => fullText.includes(keyword))) {
    return "new_shape_blocked";
  }

  if (parsedIntent === "formula_update") {
    return "formula_update";
  }

  if (formulaKeywords.some((keyword) => fullText.includes(keyword))) {
    return "formula_update";
  }

  if (mergedData.requested_formula) {
    return "formula_update";
  }

  if (mergedData.shape_name && mergedData.output_name) {
    return "formula_update";
  }

  return parsedIntent || "unknown";
}

/**
 * Deterministic fallback extraction. Port of
 * agent/langgraph_agent.py::fallback_extract_from_user_text.
 * Used when LLM JSON extraction fails or misses simple new-shape details.
 */
export function fallbackExtractFromUserText(currentData, conversationMessages) {
  const data = { ...currentData };

  const latestText = getLatestUserText(conversationMessages);
  const fullText = getFullUserText(conversationMessages);

  const fullLower = fullText.toLowerCase();

  const newShapeKeywords = ["new shape", "add shape", "create shape", "custom shape", "shape request"];

  if (newShapeKeywords.some((keyword) => fullLower.includes(keyword))) {
    data.intent_hint = "new_shape";
  }

  // Category detection
  for (const category of ["beam", "slab", "column", "footing", "raft"]) {
    if (fullLower.includes(category)) {
      data.category = category;
      break;
    }
  }

  if (!data.category) {
    data.category = "beam";
  }

  // Shape name patterns
  const shapePatterns = [
    /name of shape is\s+([A-Za-z0-9 _-]+)/i,
    /shape name is\s+([A-Za-z0-9 _-]+)/i,
    /create\s+([A-Za-z0-9 _-]+)\s+shape/i,
    /add\s+([A-Za-z0-9 _-]+)\s+shape/i,
    /new\s+([A-Za-z0-9 _-]+)\s+shape/i,
    /([A-Za-z0-9 _-]+)\s+shape/i,
  ];

  const stopWords = ["new", "a new", "the", "this", "which", "what"];

  for (const pattern of shapePatterns) {
    const match = latestText.match(pattern);
    if (match) {
      const possibleShapeName = match[1].trim();

      if (!stopWords.includes(possibleShapeName.toLowerCase())) {
        data.shape_name = toTitleCase(possibleShapeName);
        break;
      }
    }
  }

  // Description
  if (!data.description) {
    const descriptionPatterns = [
      /description is\s+(.+)/i,
      /shape is for\s+(.+)/i,
      /for\s+customized\s+(.+)/i,
      /for\s+customised\s+(.+)/i,
    ];

    for (const pattern of descriptionPatterns) {
      const match = latestText.match(pattern);
      if (match) {
        data.description = match[1].trim();
        break;
      }
    }
  }

  // Reason
  if (!data.reason) {
    const reasonPatterns = [
      /reason is\s+(.+)/i,
      /because\s+(.+)/i,
      /required for\s+(.+)/i,
      /needed for\s+(.+)/i,
      /allow me to\s+(.+)/i,
    ];

    for (const pattern of reasonPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        data.reason = match[1].trim();
        break;
      }
    }
  }

  // Output formula patterns:
  // "L1 = BX + LD"
  // "output L1 with formula BX + LD"
  const outputs = data.outputs || [];

  const outputPatterns = [
    /\b(L[0-9]+)\s*=\s*([^.,\n]+)/gi,
    /output\s+(L[0-9]+)\s+with\s+formula\s+([^.,\n]+)/gi,
    /(L[0-9]+)\s+formula\s+is\s+([^.,\n]+)/gi,
  ];

  const existingOutputNames = new Set(outputs.map((output) => (output.output_name || "").toUpperCase()));

  for (const pattern of outputPatterns) {
    for (const match of latestText.matchAll(pattern)) {
      const outputName = match[1].toUpperCase().trim();
      const formula = match[2].trim();

      if (!existingOutputNames.has(outputName)) {
        outputs.push({ output_name: outputName, formula, unit: "m" });
        existingOutputNames.add(outputName);
      }
    }
  }

  data.outputs = outputs;

  return data;
}

/** Port of agent/langgraph_agent.py::build_database_context. */
export async function buildDatabaseContext(userEmail) {
  const projects = await findUserProjects(userEmail);
  const shapes = await listActiveShapes("beam", userEmail);

  const projectNames = projects.map((project) => project.project_name).filter((name) => Boolean(name));

  const shapeInfo = shapes.map((shape) => ({
    shape_name: shape.shape_name,
    category: shape.category,
    outputs: (shape.outputs || []).map((output) => output.output_name).filter((name) => Boolean(name)),
  }));

  return {
    user_projects: projectNames,
    available_shapes: shapeInfo,
    abbreviations: ABBREVIATION_DICTIONARY,
  };
}

/** Port of agent/langgraph_agent.py::node_extract_with_llm. */
async function extractWithLlm(state) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: JSON.stringify({
        database_context: state.context || {},
        current_structured_data: state.current_structured_data || {},
      }),
    },
    ...(state.conversation_messages || []),
  ];

  try {
    const llmText = await callLlm(messages);
    const parsedResponse = extractJsonFromText(llmText);

    const parsedIntent = parsedResponse.intent || "unknown";
    const newData = parsedResponse.structured_data || {};

    const mergedData = mergeStructuredData(state.current_structured_data || {}, newData);

    const fallbackData = fallbackExtractFromUserText(mergedData, state.conversation_messages || []);

    const improvedData = improveExtractionWithContext(fallbackData, state.context || {}, state.conversation_messages || []);

    const finalIntent = determineIntent(parsedIntent, improvedData, state.conversation_messages || []);

    if (finalIntent === "new_shape_blocked") {
      return {
        intent: "general",
        response_to_user: NEW_SHAPE_BLOCKED_MESSAGE,
        missing_fields: [],
        ready_to_submit: false,
        structured_data: improvedData,
        extraction_error: null,
      };
    }

    return {
      intent: finalIntent,
      response_to_user: parsedResponse.response_to_user || "Hi, I’m Neev. How can I help you today?",
      missing_fields: parsedResponse.missing_fields || [],
      ready_to_submit: false,
      structured_data: improvedData,
      extraction_error: null,
    };
  } catch {
    const fallbackData = fallbackExtractFromUserText(state.current_structured_data || {}, state.conversation_messages || []);

    const finalIntent = determineIntent(fallbackData.intent_hint || "unknown", fallbackData, state.conversation_messages || []);

    return {
      intent: finalIntent === "new_shape_blocked" ? "general" : finalIntent,
      response_to_user:
        finalIntent === "new_shape_blocked"
          ? NEW_SHAPE_BLOCKED_MESSAGE
          : "Please share the remaining details so I can prepare the request.",
      missing_fields: [],
      ready_to_submit: false,
      structured_data: fallbackData,
      extraction_error: null,
    };
  }
}

/** Port of agent/langgraph_agent.py::node_validate_formula_update. */
async function validateFormulaUpdate(state) {
  const validationResult = await validateFormulaUpdateRequest(state.user_email, state.structured_data || {});
  return { validation_result: validationResult };
}

/** Port of agent/langgraph_agent.py::node_ready_response. */
function readyResponse(state) {
  const validationResult = state.validation_result || {};
  const resolvedData = validationResult.resolvedData ?? state.structured_data ?? {};

  return {
    intent: "formula_update",
    response_to_user: "Great, I have prepared the formula update request. Please review it before submitting.",
    missing_fields: [],
    ready_to_submit: true,
    structured_data: resolvedData,
  };
}

const VALIDATION_RESPONSE_SYSTEM_PROMPT = `
You are Neev, BuniyadByte's AI assistant.

Write a short, natural response to the user.
Do not mention JSON.
Do not mention internal validation.
Do not expose technical field names unless needed.

If project_name is missing, ask for the project name.
If shape_name is missing, ask which shape.
If output_name is missing, ask which output such as L1, L2, or L3.
If requested_formula is missing, ask for the new formula.
If reason is missing, ask why the change is needed.
If the error says unknown abbreviation, ask the user to correct only those abbreviation(s).
If description is missing, ask for a short shape description.
If outputs is missing, ask for output names and formulas such as L1 = BX + LD.
For new shape requests, do not ask for image upload in chat.

Keep the message compact and friendly.

Return only valid JSON:
{
  "response_to_user": "your message"
}
`;

/** Port of agent/langgraph_agent.py::node_validation_response. */
async function validationResponse(state) {
  const validationResult = state.validation_result || {};

  const feedback = {
    missing_fields: validationResult.missingFields || [],
    error: validationResult.error ?? null,
    structured_data: state.structured_data || {},
  };

  const messages = [
    { role: "system", content: VALIDATION_RESPONSE_SYSTEM_PROMPT },
    { role: "system", content: JSON.stringify(feedback) },
    ...(state.conversation_messages || []).slice(-4),
  ];

  let responseToUser;
  try {
    const llmText = await callLlm(messages);
    const parsed = extractJsonFromText(llmText);
    responseToUser = parsed.response_to_user || "Please share the missing details so I can prepare the request.";
  } catch {
    responseToUser = "Please share the missing details so I can prepare the request.";
  }

  return {
    response_to_user: responseToUser,
    missing_fields: validationResult.missingFields || [],
    ready_to_submit: false,
    structured_data: state.structured_data || {},
  };
}

/**
 * Public entrypoint. Port of agent/langgraph_agent.py::run_formula_update_agent.
 * Reimplements the 5-node LangGraph state machine (build_context -> extract_with_llm
 * -> [validate_formula_update] -> ready_response|validation_response) as a plain
 * sequential pipeline, since there is no tool-calling/branching complexity beyond
 * the conditional routing reproduced below.
 */
export async function runFormulaUpdateAgent({ userEmail, conversationMessages, currentStructuredData }) {
  let state = {
    user_email: userEmail,
    conversation_messages: conversationMessages || [],
    current_structured_data: currentStructuredData || {},

    context: {},
    intent: "unknown",
    response_to_user: "",
    missing_fields: [],
    ready_to_submit: false,
    structured_data: currentStructuredData || {},
    validation_result: {},
    extraction_error: null,
  };

  // node_build_context
  state = { ...state, context: await buildDatabaseContext(userEmail) };

  // node_extract_with_llm
  state = { ...state, ...(await extractWithLlm(state)) };

  // route_after_extraction
  if (!state.extraction_error && state.intent === "formula_update") {
    // node_validate_formula_update
    state = { ...state, ...(await validateFormulaUpdate(state)) };

    // route_after_validation
    if (state.validation_result?.isValid) {
      state = { ...state, ...readyResponse(state) };
    } else {
      state = { ...state, ...(await validationResponse(state)) };
    }
  }

  return {
    intent: state.intent ?? "unknown",
    response_to_user: state.response_to_user || "Hi, I’m Neev. How can I help you today?",
    missing_fields: state.missing_fields ?? [],
    ready_to_submit: state.ready_to_submit ?? false,
    structured_data: state.structured_data ?? {},
  };
}
