const express = require("express");
const { getDb } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const { hashPassword } = require("../utils/auth");
const { getNextUserId } = require("../utils/ids");
const router = express.Router();

// Every route here requires an admin to be logged in
router.use(requireAuth, requireRole("admin"));

// GET /api/admin/users?searchText=&roleFilter=
router.get("/", asyncHandler(async (req, res) => {
  const { searchText, roleFilter } = req.query;
  const db = getDb();

  const filter = {};

  if (searchText) {
    // Case-insensitive match on name OR email
    const regex = new RegExp(searchText, "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }

  if (roleFilter) {
    filter.role = roleFilter;
  }

  const users = await db
    .collection("users")
    .find(filter)
    .project({ passwordHash: 0 }) // never send password hashes to the client
    .sort({ id: 1 })
    .toArray();

  const result = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  }));

  res.json(result);
}));

// GET /api/admin/users/:userId
router.get("/:userId", asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const db = getDb();

  const user = await db.collection("users").findOne({ id: userId });
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    // Stubbed until Projects / AutoCAD Imports / Beams are built
    stats: {
      projects_count: 0,
      autocad_imports_count: 0,
      beams_count: 0,
      filled_beams_count: 0,
    },
    projects: [],
  });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  const safeRole = role === "admin" ? "admin" : "user";

  const db = getDb();
  const users = db.collection("users");

  const existing = await users.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ error: "That email is already registered." });
  }

  const passwordHash = await hashPassword(password);
  const id = await getNextUserId(safeRole);

  const newUser = {
    id,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: safeRole,
    status: "active",
    createdAt: new Date(),
  };

  await users.insertOne(newUser);

  return res.status(201).json({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    status: newUser.status,
  })
}))
module.exports = router