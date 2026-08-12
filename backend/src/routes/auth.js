const express = require("express");
const { getDb } = require("../db");
const { hashPassword, comparePassword, signToken } = require("../utils/auth");
const { getNextUserId } = require("../utils/ids");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// POST /api/auth/register
// Body: { name, email, password, confirmPassword, role }
router.post("/register", asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword, role } = req.body;

  // --- Basic validation ---
  if (!name || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  const safeRole = role === "admin" ? "admin" : "user"; // anything else defaults to "user"

  const db = getDb();
  const users = db.collection("users");

  const existing = await users.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ error: "That email is already registered." });
  }

  // --- Create the user ---
  const passwordHash = await hashPassword(password);
  const id = await getNextUserId(safeRole); // 1,2,3... for users - 400,401... for admins

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

  // Never send the password hash back to the client
  return res.status(201).json({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
  });
}));

// POST /api/auth/login
// Body: { email, password }
// Returns: { token, user: { id, name, email, role } }
router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const db = getDb();
  const user = await db.collection("users").findOne({ email: email.toLowerCase() });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken(user); // expires in 24h - see utils/auth.js

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}));

module.exports = router;