# Neev agent — contract notes

Port of `Neev_POC/agent/*.py`. No LangChain/LangGraph dependency — the 5-node
graph (`build_context -> extract_with_llm -> [validate_formula_update] ->
ready_response | validation_response`) is reimplemented in
`langgraphAgent.js` as a plain sequential async pipeline with the same
conditional routing, since there is no tool-calling involved.

## `runFormulaUpdateAgent({ userEmail, conversationMessages, currentStructuredData })`

Single public entrypoint (`server/src/agent/langgraphAgent.js`).

**Input**
- `userEmail: string`
- `conversationMessages: Array<{ role: "user" | "assistant", content: string }>`
  — full running chat history for the turn.
- `currentStructuredData: object` — the structured_data accumulated so far
  (from the previous turn's response), `{}` on the first turn.

**Output** (always this shape, never throws — internal LLM failures degrade
to regex-only extraction):
```js
{
  intent: "general" | "formula_update" | "formula_explanation" | "abbreviation_help" | "unknown",
  response_to_user: string,
  missing_fields: string[],
  ready_to_submit: boolean,
  structured_data: {
    project_name, project_id, category, shape_id, shape_name,
    output_name, current_formula, requested_formula, reason,
    description, outputs, ...
  }
}
```

When `ready_to_submit === true` and `intent === "formula_update"`,
`structured_data` is fully resolved (project_id/shape_id/current_formula
filled in from the DB) and safe to hand to `POST /api/ai/chat/submit`
unmodified.

New-shape requests are always blocked (`NEW_SHAPE_BLOCKED_MESSAGE`,
`intent: "general"`) regardless of what the LLM said — this is a hard
business rule, not a suggestion.

## `POST /api/ai/chat`

Auth required (applied by `app.js`). One turn of conversation.

Request body:
```json
{ "conversationMessages": [...], "currentStructuredData": {...} }
```

Response body: exactly the `runFormulaUpdateAgent` output above (200), or
`{ "error": "..." }` (500) if something unexpected throws.

`userEmail` is taken from `req.user.email` (JWT), not from the body.

## `POST /api/ai/chat/submit`

Auth required. Call this once `ready_to_submit` is true and the user
confirms the preview. Body is the `structured_data` object as returned by
`POST /api/ai/chat` (the resolved one from a `ready_to_submit: true`
response).

Creates a `pending` `formula_update` document in `ai_requests` (via
`createAiRequest`, which precomputes the `_id` so `request_code` is set in
one insert) with `requested_by`/`requested_by_name` from `req.user`, plus
auto-generated `ai_summary`/`ai_suggestion` strings.

Response: `201 { "requestId": "<hex>", "requestCode": "AIR-XXXXXX" }`, or
`{ "error": "..." }` (500) on failure.
