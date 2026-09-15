import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { AppError } from "../errors.js";

const claimsSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["USER", "MANAGER", "ADMIN"]),
});

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    return next(new AppError(401, "Authentication is required", "UNAUTHENTICATED"));
  }

  try {
    const claims = claimsSchema.parse(jwt.verify(token, config.JWT_SECRET));
    req.auth = { userId: claims.sub, email: claims.email, role: claims.role };
    next();
  } catch {
    next(new AppError(401, "Your session is invalid or has expired", "INVALID_TOKEN"));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN") {
    return next(new AppError(403, "Administrator access is required", "FORBIDDEN"));
  }
  next();
}
