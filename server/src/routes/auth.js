import { Router } from "express";
import { usersCollection } from "../db/index.js";
import { hashPassword, checkPassword, signToken } from "../utils/auth.js";

const router = Router();

async function countAdminUsers() {
  return usersCollection.countDocuments({ role: "admin" });
}

router.post("/register", async (req, res) => {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const { password, confirmPassword } = req.body;
  const role = req.body.role === "admin" ? "admin" : "user";

  if (!name || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  const existing = await usersCollection.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "Email is already registered." });
  }

  // POC-only cap, mirrors original Streamlit app's demo limit.
  if (role === "admin" && (await countAdminUsers()) >= 1) {
    return res.status(403).json({ error: "Only one admin is allowed in this POC." });
  }

  const now = new Date();
  await usersCollection.insertOne({
    name,
    email,
    password: await hashPassword(password),
    role,
    status: "active",
    created_at: now,
    updated_at: now,
  });

  res.status(201).json({ message: "Registration successful." });
});

router.post("/login", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = await usersCollection.findOne({ email });
  if (!user || !(await checkPassword(password, user.password))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
  });
});

export default router;
