# Login / Register App — React + FeathersJS + JWT + MongoDB

## Structure
```
login-register-app/
├── backend/     # FeathersJS API (Express transport, JWT auth, MongoDB)
└── frontend/    # React app (Vite) with Login/Register forms
```

## 1. Backend setup

```bash
cd backend
npm install
```

Your `.env` is already filled in with the MongoDB URI you gave me:
```
MONGODB_URI=mongodb+srv://hemilbono_db_user:kD7LVQcMkJQPCoHL@sharemanagement.fwu5vfm.mongodb.net/login_register_db
```
I added `/login_register_db` as the database name (Mongo creates it automatically on first write) — change it to whatever name you want.

**Change `JWT_SECRET` in `.env` to a long random string before you go anywhere near production.**

Start the server:
```bash
npm start
```
You should see:
```
✅ Connected to MongoDB
🚀 Server running on http://localhost:3030
```

## 2. Frontend setup

```bash
cd frontend
npm install
npm start
```
This runs Vite on `http://localhost:5173` by default.

If your backend runs on a different port/host, update `BACKEND_URL` in
`frontend/src/api/feathersClient.js`.

## How auth works

- `POST /users` (via `client.service('users').create(...)`) → registers a user, password gets hashed with bcrypt before it's stored.
- `POST /authentication` (via `client.authenticate(...)`) → logs in with email + password, returns a JWT.
- The JWT is stored in `localStorage` (by `@feathersjs/authentication-client`) and automatically attached to every future request.
- Any service method guarded with `authenticate('jwt')` (see `users.hooks.js`) requires a valid token.
- On page refresh, `App.jsx` calls `client.reAuthenticate()` to restore the session from the stored token.

## Security notes

- **Never commit `.env`** — it's already in `.gitignore`. Since the Mongo password was pasted in this chat, consider rotating it in Atlas (Database Access → Edit user → Edit password) once you're done testing.
- Passwords are hashed with bcrypt via `@feathersjs/authentication-local` — never stored in plain text.
- `protect('password')` in `users.hooks.js` strips the password hash out of every API response.
