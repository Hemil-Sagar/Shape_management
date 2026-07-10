# Shapes / Custom Shapes / AI Requests API

All routes below require `Authorization: Bearer <token>` (applied at mount time in
`app.js` via `requireAuth`), except `GET /api/images/:fileId` (separate router).
Routes marked **(admin)** additionally require `req.user.role === "admin"`
(`requireRole("admin")`).

Every document response converts Mongo's `_id` into a string `id` field
(`{ id, ...rest }`); nested Mongo ids elsewhere in a document (e.g.
`base_shape_id`, `ai_request_id`) remain plain strings as stored.

On an invalid/malformed `:id` path param, every route responds `404` (never `500`),
matching the original Python's `try/except ObjectId(...): return None` pattern.

---

## `/api/shapes` (mounted with `requireAuth`)

### `GET /api/shapes`
List global shapes. Query: `category` (e.g. `beam`), `searchText` (case-insensitive
substring match on `shape_name`), `statusFilter` (`All` default | `Active` | `Inactive`).
Sorted `created_at` desc.
Response: `Shape[]`.

### `GET /api/shapes/assigned?userEmail=X` **(admin)**
Global shapes restricted to one user (`user_email === userEmail`). Sorted `shape_name` asc.
Response: `Shape[]`.

### `GET /api/shapes/available-for-project?projectId=X&category=beam`
Wraps `shapeResolver.getAvailableShapesForProject`. `projectId` required (400 if missing).
Response: `[{ option_label, option_key, shape_id, shape_name, shape_source }]`.

### `GET /api/shapes/resolve?projectId=X&selectedShapeKey=Y&shapeId=Z`
Wraps `shapeResolver.resolveShapeForProject`. `projectId` required (400).
`selectedShapeKey` (e.g. `"global:<id>"` / `"custom:<id>"`) OR `shapeId` (defaults to
`source="global"`). 404 `{ error: "Could not resolve shape for this project." }` if
resolution fails (e.g. shape not visible/found).
Response: the resolved shape doc (with `outputs[].formula_source`, `shape_source`,
`shape_id`, `base_shape_id`, `custom_shape_id` set) — plain object, `_id` still Mongo
form since it's not passed through `toJson` (structuredClone of the raw doc).

### `GET /api/shapes/:id`
Response: `Shape` or 404.

### `POST /api/shapes` **(admin)**, `multipart/form-data`, field `image` (optional file)
Body fields (form fields, not JSON): `shape_name` (required), `category` (default `"beam"`),
`description`, `user_email` / `user_name` (optional — omit/null = visible to everyone),
`outputs` (JSON-stringified array of `{output_name, formula, unit}`).
Validation (exact order/wording):
1. `shape_name` required → 400 `"Shape name is required."`
2. Duplicate check (case-sensitive exact match on `shape_name` + `category`) → 409
   `"A general shape with this name already exists in this category."`
3. Each output validated (trim; `output_name` required → 400 `"Output name is required."`;
   `formula` required → 400 `` `Formula is required for ${output_name}.` ``; `unit` defaults `"m"`).
Response: `201` with created `Shape`.

### `PATCH /api/shapes/:id` **(admin)**, `multipart/form-data`, field `image` (optional file)
Same body fields/validation as POST, but duplicate check excludes self (`find_duplicate_shape`
equivalent). If a new `image` file is uploaded, image fields are fully replaced (old GridFS
blob is NOT deleted — see `// TODO` in source, matches original Python behavior). If no file
uploaded, existing image fields are preserved. `is_active` optional (`"true"`/`true`/omitted
= keep existing).
Response: updated `Shape`, or 404.

### `POST /api/shapes/:id/deactivate` **(admin)** / `POST /api/shapes/:id/reactivate` **(admin)**
No body. Sets `is_active` false/true + `updated_at`. Response: updated `Shape`, or 404.

### `DELETE /api/shapes/:id` **(admin)**
Hard delete. `204` on success, 404 if not found.

---

## `/api/custom-shapes` (mounted with `requireAuth`)

Every item returned from list/get endpoints is **enriched** (mirrors
`shape_service.py::enrich_custom_item`) with these computed fields:
`project_name` (fallback `"All projects of {user_name || user_email}"` when
user-scoped and no project_name), `request_code`, `requested_by_name`,
`requested_by`, `request_reason` (from the linked `ai_requests` doc, resolved via
`ai_request_id` or, for `formula_override` items with no direct link, the last
`override_outputs[].ai_request_id`; `"N/A"` fields / `AIR-{last6}` fallback code if
no linked request), `customization_type_label` (`"Custom Formula"` |
`"Custom Shape"`), `display_shape_name`, `display_description`, `display_outputs`
(type-branching accessors), and `display_image_*` (for `formula_override` items,
pulled from the **base shape's** image fields via `base_shape_id` lookup, since
overrides don't own an image; for `custom_shape` items, the item's own image fields).

### `GET /api/custom-shapes`
Query: `category`, `searchText` (regex OR across `project_name`, `shape_name`,
`base_shape_name`, `user_email`, `user_name`), `statusFilter` (`All`|`Active`|`Inactive`).
Sorted `updated_at` desc. Response: enriched `CustomShapeItem[]`.

### `GET /api/custom-shapes/for-user?userEmail=X` **(admin)**
Union of items with `user_email === userEmail` OR `project_id` in that user's
project ids (legacy project-scoped items). Response: enriched `CustomShapeItem[]`.

### `GET /api/custom-shapes/:id`
Response: enriched `CustomShapeItem` or 404.

### `POST /api/custom-shapes/project`, `multipart/form-data`, field `image` (optional)
Creates a project-scoped custom shape (`type: "custom_shape"`). Body: `project_id`
(required, 400), `project_name`, `category` (default `"beam"`), `shape_name`
(required, 400), `description`, `outputs` (JSON array), `ai_request_id` (optional).
Same per-output validation as shapes.js. Response: `201` with created item (not enriched).

### `POST /api/custom-shapes/user` **(admin)**, `multipart/form-data`, field `image` (optional)
Creates a user-scoped custom shape (visible to that user across all their projects).
Body: `user_email` (required, 400), `user_name`, `category`, `shape_name` (required, 400),
`description`, `outputs`. Duplicate check: exact match on `user_email` + `category` +
`type:"custom_shape"` + `shape_name` → 409. Response: `201` with created item.

### `PATCH /api/custom-shapes/:id/formula-override` **(admin)**
Body: `override_outputs: [{output_name, formula, unit?}]`, `is_active?`.
404 `{error:"Custom formula override not found."}` if no doc of
`type:"formula_override"` matches `:id`. Merges each output by lowercased
`output_name`, preserving the existing output's `ai_request_id`; sets
`source:"manual_admin_edit"`. Each output requires non-empty `output_name` and
`formula` (trimmed) → 400 `{error:"Each output must have output name and formula."}`.
Response: updated enriched item.

### `PATCH /api/custom-shapes/:id` **(admin)**, `multipart/form-data`, field `image` (optional)
Updates a `custom_shape`-type item (`update_project_custom_shape`). Body: `shape_name`
(required, 400), `description`, `outputs` (validated same as create), `is_active?`.
Duplicate check branches on scope: if item has `user_email` set →
`find_duplicate_user_custom_shape`-equivalent (scoped to user+category, excludes
self); else → project+category scoped (excludes self) → 409 with scope-appropriate
message. New image replaces old fields if uploaded (old blob not deleted, TODO noted
in source). Response: updated enriched item, or 404.

### `POST /api/custom-shapes/:id/deactivate` **(admin)** / `POST /api/custom-shapes/:id/reactivate` **(admin)**
Sets `is_active` + `updated_by` + `updated_at`. Response: updated enriched item, or 404.

### `DELETE /api/custom-shapes/:id` **(admin)**
Hard delete. `204` on success, 404 if not found.

### `POST /api/custom-shapes/apply-formula-override` **(admin)**
Wraps `shapeResolver.upsertProjectFormulaOverride`. Body: `project_id`, `project_name`,
`category`, `base_shape_id`, `base_shape_name`, `output_name`, `formula`, `unit`,
`ai_request_id?`. Required: `project_id`, `base_shape_id`, `output_name`, `formula` (400
if any missing). Response: `{ custom_shape_library_id }`.

### `POST /api/custom-shapes/approve-new-shape-request` **(admin)**
Body: `{ requestId }`. Fetches the `ai_requests` doc, converts it into a project
custom shape (`approve_new_shape_request_to_project` equivalent). 400 with exact
Python `ValueError` message if the request is missing `project_id`
(`"Request is missing project ID."`), `shape_name`
(`"Request is missing shape name."`), or non-empty `outputs`
(`"Request is missing shape outputs."`). Response: `{ custom_shape_library_id }`.
Also exported as `approveNewShapeRequestToProject(request, adminEmail)` from
`customShapes.js` and reused by `aiRequests.js`'s `/apply-new-shape` route.

---

## `/api/ai-requests` (mounted with `requireAuth`)

### `POST /api/ai-requests`
Creates an AI request document. Body: any `ai_requests` fields (e.g. `request_type`,
`project_id`, `project_name`, `category`, `shape_id`, `shape_name`, `output_name`,
`current_formula`, `requested_formula`, `reason`, `ai_summary`, `ai_suggestion`,
`new_shape_payload`, etc). `requested_by`/`requested_by_name` are always set from
`req.user` (email/name), `status` defaults to `"pending"` if not given,
`created_at`/`updated_at` set server-side. `request_code` (`AIR-{last6 of id}`) is
generated in the **same insert** (id precomputed via `new ObjectId()`) — an
improvement over the Python's two-write insert-then-update pattern.
Response: `201` with created request (including `request_code`).

### `GET /api/ai-requests/mine`
Requests created by the current user (`requested_by === req.user.email`). Query:
`statusFilter` (`All` default, else lowercased exact match), `searchText` (regex OR
across `request_code`, `project_name`, `shape_name`, `output_name`). Sorted
`created_at` desc. Response: `AiRequest[]`.

### `GET /api/ai-requests` **(admin)**
All requests. Query: `statusFilter`, `requestTypeFilter` (exact match, NOT
lowercased), `searchText` (regex OR across `request_code`, `project_name`,
`shape_name`, `output_name`, `requested_by`). Response: `AiRequest[]`.

### `GET /api/ai-requests/:id`
Response: `AiRequest` or 404.

### `POST /api/ai-requests/:id/apply-formula-update` **(admin)**
Ports `apply_formula_update_request`. Body: `{ admin_comment? }`. Validates the
request has `project_id`, `shape_id`, `shape_name`, `output_name`,
`requested_formula` → 400 if any missing. Loads the base shape by `shape_id` (404 if
not found), finds the matching output (case-insensitive `output_name`) to read its
current `unit` (defaults `"m"`) — 400 if the output isn't found on the base shape.
Calls `shapeResolver.upsertProjectFormulaOverride`, then marks the request
`status:"applied"` (see shared apply logic below). Response: updated `AiRequest`.

### `POST /api/ai-requests/:id/apply-new-shape` **(admin)**
Body: `{ admin_comment? }`. Delegates to the shared
`approveNewShapeRequestToProject(request, adminEmail)` (imported from
`customShapes.js`), then marks the request applied. Same 400 error messages as
`POST /api/custom-shapes/approve-new-shape-request` if the request payload is
incomplete. Response: updated `AiRequest`.

Both apply routes share one internal `markAiRequestApplied(oid, adminEmail,
adminComment, customShapeLibraryId)` helper — the Python's
`mark_ai_request_applied` / `mark_ai_request_applied_new_shape` were identical
functions, so only one exists here. It sets `status:"applied"`, `scope:"project"`,
`custom_shape_library_id`, `admin_comment`, `applied_by`, `applied_at`, `updated_at`.

### `POST /api/ai-requests/:id/reject` **(admin)**
Body: `{ admin_comment? }`. Sets `status:"rejected"`, `admin_comment`,
`rejected_by`, `rejected_at`, `updated_at`. Response: updated `AiRequest`, or 404.

---

## Notes for frontend integration

- Multipart uploads: use `FormData` with field name `image` for the file, plus other
  fields as regular form fields. `outputs` must be sent as a **JSON string** (e.g.
  `formData.append("outputs", JSON.stringify(outputsArray))`) since it's an array
  going through `multipart/form-data`.
- For `POST /api/custom-shapes/project` (non-admin, e.g. a project owner requesting
  their own custom shape) there is no `requireRole` guard — any authenticated user
  can call it, matching original Streamlit behavior where this flow isn't strictly
  admin-gated in the same way general shape creation is.
- Image bytes are served separately via `GET /api/images/:fileId` (see `images.js`,
  not part of this doc) — use `image_file_id` / `display_image_file_id` from these
  responses to build that URL.
