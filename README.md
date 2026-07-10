# Neev (BBSteel) — Node/Express + React

JS port of the original `Neev_POC` Streamlit/Python app. Same MongoDB data model and business logic; real auth (JWT) replaces Streamlit's server-side session state.

## Structure

- `server/` — Express API (ESM, MongoDB driver, JWT auth, GridFS image storage, formula engine, AI assistant). See `server/src/routes/ROUTES_CORE.md`, `ROUTES_SHAPES.md`, `server/src/agent/AGENT_NOTES.md` for the full endpoint contract.
- `client/` — React (Vite) SPA. Admin and user route trees mirror the original `admin_router.py`/`user_router.py`.

## Setup

```bash
cd server && cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, LLM_API_KEY
npm install
npm run dev                          # http://localhost:4000

cd ../client
npm install
npm run dev                          # http://localhost:5173 (proxies /api to :4000)
```

## Notes carried over from the original POC

- Admin registration cap (max 1 admin) preserved; the 3-user cap was removed — unlimited normal users. Adjust in `server/src/routes/auth.js`.
- Only the Beam calculation flow is implemented end-to-end; Slab/Column/Footing, Waste Inventory, Access Control, Audit Logs, Settings, Subscription, etc. are placeholder pages, same as the original.
- Formula evaluation uses `expr-eval-fork` (a maintained, prototype-pollution-patched fork) instead of Python's `simpleeval`.
