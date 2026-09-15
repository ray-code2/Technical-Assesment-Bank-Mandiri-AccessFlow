import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import type { Database } from "../database/db.js";
import { AppError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: "USER" | "MANAGER" | "ADMIN";
  passwordHash: string;
  managerId: string | null;
  managerName: string | null;
}

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many login attempts. Try again later." } },
});

const selectUser = `
  SELECT u.id, u.email, u.full_name AS "fullName", u.role,
         u.password_hash AS "passwordHash", u.manager_id AS "managerId",
         manager.full_name AS "managerName"
  FROM users u
  LEFT JOIN users manager ON manager.id = u.manager_id
`;

function publicUser(user: UserRow) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function authRouter(db: Database) {
  const router = Router();

  router.post("/login", loginLimiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await db.query<UserRow>(`${selectUser} WHERE LOWER(u.email) = $1 AND u.is_active = TRUE`, [
      input.email,
    ]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, "Email or password is incorrect", "INVALID_CREDENTIALS");
    }

    const token = jwt.sign(
      { email: user.email, role: user.role },
      config.JWT_SECRET,
      { subject: user.id, expiresIn: config.JWT_EXPIRES_IN } as SignOptions,
    );
    res.json({ token, user: publicUser(user) });
  });

  router.get("/me", requireAuth, async (req, res) => {
    const result = await db.query<UserRow>(`${selectUser} WHERE u.id = $1 AND u.is_active = TRUE`, [
      req.auth!.userId,
    ]);
    const user = result.rows[0];
    if (!user) throw new AppError(401, "User account is no longer active", "UNAUTHENTICATED");
    res.json({ user: publicUser(user) });
  });

  return router;
}
