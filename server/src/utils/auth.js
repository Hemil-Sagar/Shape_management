import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export function signToken(user) {
  return jwt.sign(
    { userId: String(user._id), email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
