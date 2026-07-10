# Core Domain Routes

All routes below require `Authorization: Bearer <token>` (via `requireAuth`, applied
at mount time in `app.js`). Admin-only routes additionally require `role: "admin"`
(`requireRole("admin")`), noted per-route.

Every Mongo document in a response is serialized as `{ id: "<string>", ...rest }`
(no raw `_id` field). Malformed/unknown `:id` path params return `404 { error }`,
never `500`.

---

## `/api/projects` (projects.js)

| Method | Path | Query | Body | Response |
|---|---|---|---|---|
| GET | `/` | `searchText?` | — | `Project[]`. Admin sees all projects; non-admin sees only `created_by === req.user.email`. Case-insensitive `project_name` regex if `searchText` given. Sorted `created_at` desc. |
| GET | `/:id` | — | — | `Project` or 404 |
| POST | `/` | — | `{ project_name, description?, start_date, end_date }` | 201 `Project`. `project_name`/`start_date`/`end_date` required (400 otherwise). Auto-generates `project_code` as `PROJ0001`, `PROJ0002`, ... via document count (see TODO/race-condition note in source — not fixed, faithful port). `start_date`/`end_date` stored as strings. `created_by`/`created_by_name` from `req.user`. |
| PATCH | `/:id` | — | arbitrary fields to `$set` | Updated `Project` or 404. Sets `updated_at`. |

`Project` shape: `{ id, project_code, project_name, description, start_date, end_date, created_by, created_by_name, created_at, updated_at, status }`

---

## `/api/blocks` (blocks.js)

| Method | Path | Query | Body | Response |
|---|---|---|---|---|
| GET | `/` | `projectId` (required), `searchText?` | — | `Block[]`, scoped to `projectId`. 400 if `projectId` missing. |
| GET | `/:id` | — | — | `Block` or 404 |
| POST | `/` | — | `{ project_id, project_code?, block_name, block_description? }` | 201 `Block`. `project_id`/`block_name` required. |

`Block` shape: `{ id, project_id, project_code, block_name, block_description, created_by, created_by_name, created_at, updated_at, status }`

---

## `/api/floors` (floors.js)

| Method | Path | Query | Body | Response |
|---|---|---|---|---|
| GET | `/` | `projectId` (required), `blockId` (required), `searchText?` | — | `Floor[]`, scoped to project+block. 400 if either id missing. |
| GET | `/:id` | — | — | `Floor` or 404 |
| POST | `/` | — | `{ project_id, block_id, project_code?, block_name?, floor_name, floor_description? }` | 201 `Floor`. `project_id`/`block_id`/`floor_name` required. |

`Floor` shape: `{ id, project_id, block_id, project_code, block_name, floor_name, floor_description, created_by, created_by_name, created_at, updated_at, status }`

---

## `/api/autocad-imports` (autocadImports.js)

| Method | Path | Query | Body | Response |
|---|---|---|---|---|
| GET | `/` | `projectId` (required), `searchText?`, `statusFilter?` (default effectively "All") | — | `AutocadImport[]`, scoped to project. `searchText` matches `name` case-insensitively. `statusFilter !== "All"` filters exact `status`. Sorted `imported_at` desc. |
| GET | `/:id` | — | — | `AutocadImport` or 404 |
| POST | `/` | — | `{ project_id, project_code?, import_name, block_id, block_name?, floor_id, floor_name?, drawing_number?, structure_name? }` | 201 `AutocadImport`. `project_id`/`import_name`/`block_id`/`floor_id` required. `status` starts `"Pending"`. `imported_by`/`imported_by_name` from `req.user`. |

`AutocadImport` shape: `{ id, project_id, project_code, name, block_id, block_name, floor_id, floor_name, drawing_number, structure_name, imported_by, imported_by_name, imported_at, updated_at, status }`

---

## `/api/beams` (beams.js)

| Method | Path | Query | Body | Response |
|---|---|---|---|---|
| GET | `/` | `projectId` (required), `autocadImportId` (required), `searchText?`, `statusFilter?` | — | `Beam[]`, scoped to project+import. `searchText` matches `beam_name`. `statusFilter !== "All"` filters exact `status` ("Filled"/"Unfilled"). |
| GET | `/:id` | — | — | `Beam` or 404 |
| POST | `/` | — | `{ project_id, autocad_import_id, block_id?, block_name?, floor_id?, floor_name?, beam_name, beam_description? }` | 201 `Beam`. `project_id`/`autocad_import_id`/`beam_name` required. Initializes `shape_id/shape_name/selected_shape_key/shape_source/base_shape_id/custom_shape_id: null`, `inputs: {}`, `outputs: []`, `status: "Unfilled"`. |
| PATCH | `/:id/calculation` | — | arbitrary fields (calculation result: `shape_id`, `inputs`, `outputs`, `status`, etc.) | Updated `Beam` or 404. Permissive `$set` of whatever body is sent, plus `updated_at` — intended for the beam-calculation engine to persist results. |
| POST | `/:id/calculate` | — | `{ selectedShapeKey, projectId, inputs: { number_of_repetitions, BX, BY, BZ, CX, CY, bar_dia, CO, grade_of_concrete, grade_of_steel, SD?, LS?, SS? } }` | Updated `Beam` or 404/400. **The beam calculation engine** (ports `ui/beams.py::beam_input_calculation_form`). 400 if `projectId`/`selectedShapeKey`/`inputs` missing, or if `BX`/`BY`/`BZ` aren't each `> 0`. Calls `shapeResolver.resolveShapeForProject(projectId, selectedShapeKey)` (404 `"Selected shape could not be resolved."` if it fails) to get the live effective shape+formulas, derives `BR`/`D` from `bar_dia` via `parseBarDia`, `GC`/`GS` from the grade dicts, `LD` via `calculateLd(grade_of_concrete, grade_of_steel, D)`, defaults `SD=8, LS=2, SS=150` if omitted, then evaluates every output formula via `calculateShapeOutputs`. `$set`s `{selected_shape_key, shape_id, shape_name, shape_source, base_shape_id, custom_shape_id, inputs (raw + derived BR/D/GC/GS/LD/grade labels), outputs, status:"Filled", updated_at}` on the beam and returns it. Client only needs to send raw form inputs — all derived engineering values are computed server-side. |

`Beam` shape: `{ id, project_id, autocad_import_id, block_id, block_name, floor_id, floor_name, beam_name, beam_description, shape_id, shape_name, selected_shape_key, shape_source, base_shape_id, custom_shape_id, inputs, outputs, status, created_by, created_by_name, created_at, updated_at }`

---

## `/api/admin/users` (adminUsers.js) — all routes require `role: "admin"`

| Method | Path | Query | Body | Response |
|---|---|---|---|---|
| GET | `/` | `searchText?`, `roleFilter?` (default `"user"`, case-insensitive; `"All"` = no role filter) | — | `User[]` (password field stripped). `searchText` does `$or` regex across `name`/`email`/`role`. Sorted `created_at` desc. |
| GET | `/:id` | — | — | `{ user: User, stats: { projects_count, autocad_imports_count, beams_count, filled_beams_count, ai_requests_count }, projects: Project[] }` or 404. Combines `get_user_by_id` + 5 count functions + project list into one response (deviates from the original's separate calls, for practical REST reasons). |

`User` shape: `{ id, name, email, role, status, created_at, updated_at }` (no `password`)

---

## `/api/dashboard` (dashboard.js)

| Method | Path | Query | Body | Response |
|---|---|---|---|---|
| GET | `/admin` | — (requires `role: "admin"`) | — | `{ stats: { total_users, total_projects, total_shapes, total_imports, total_beams, filled_beams, pending_ai_requests }, recent_projects: Project[] (5, sorted created_at desc), recent_shapes: Shape[] (5, sorted created_at desc) }` |
| GET | `/user` | — | — | `{ stats: { total_projects, pending_ai_requests, applied_ai_requests } }`, scoped to `req.user.email`. |

---

## Notes / judgment calls

- **`generate_project_code` race condition**: preserved as-is from the Python original (count-based, not atomic). A `// ponytail:` / TODO comment is left in `projects.js` — not fixed per task instructions.
- **Admin user list `roleFilter`**: defaults to `"user"` exactly like the Python `list_users(role_filter="user")`, meaning by default admins never see other admin accounts in this list unless `roleFilter=All` is passed explicitly.
- **Admin user detail / dashboard**: combined multiple original service calls (`get_user_by_id` + 5 counters; 7 dashboard counters + 2 recent-lists) into single response objects, per explicit task instructions, to avoid the client needing 6+ round trips.
- **`PATCH /api/beams/:id/calculation`** is intentionally unvalidated/permissive (arbitrary `$set`), mirroring the Python `update_beam_calculation(beam_id, beam_update: dict)` which does the same — the beam-calculation route (owned by another agent) is expected to call this with the correct payload shape.
- **List routes needing a scope id** (`blocks`, `floors`, `autocad-imports`, `beams`) return **400** if the required query param(s) are missing, since the original Python functions always required these as positional args (no "list everything" mode existed for these entities).
