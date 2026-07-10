import { config } from "../config/env.js";

/**
 * Calls the configured LLM chat-completions endpoint.
 * Port of agent/llm_client.py::call_llm.
 */
export async function callLlm(messages) {
  if (!config.llm.apiKey) {
    throw new Error("LLM_API_KEY missing in .env");
  }

  if (!config.llm.baseUrl) {
    throw new Error("LLM_BASE_URL missing in .env");
  }

  if (!config.llm.model) {
    throw new Error("LLM_MODEL missing in .env");
  }

  const payload = {
    model: config.llm.model,
    messages,
    temperature: 0.1,
  };

  const response = await fetch(config.llm.baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.llm.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Extracts a JSON object from raw LLM text output, tolerating markdown
 * code fences and leading/trailing prose around the JSON payload.
 * Port of agent/llm_client.py::extract_json_from_text.
 */
export function extractJsonFromText(text) {
  let cleaned = (text ?? "").trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replaceAll("```json", "")
      .replaceAll("```JSON", "")
      .replaceAll("```", "")
      .trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to brace-scan fallback
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start !== -1 && end !== -1 && end > start) {
    const jsonText = cleaned.slice(start, end + 1);

    try {
      return JSON.parse(jsonText);
    } catch {
      // fall through to error below
    }
  }

  throw new Error(`LLM did not return valid JSON. Raw response: ${cleaned}`);
}
