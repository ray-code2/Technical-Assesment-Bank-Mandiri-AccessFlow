import { Router } from "express";
import { z } from "zod";
import type { Database } from "../database/db.js";
import { AppError } from "../errors.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

interface AccessTypeRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
  createdAt: Date;
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(240),
  icon: z.enum(["shield", "code", "palette", "ticket", "database", "key"]).default("key"),
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

const selectAccessTypes = `
  SELECT id, name, description, icon, is_active AS "isActive", created_at AS "createdAt"
  FROM access_types
`;

export function accessTypesRouter(db: Database) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (_req, res) => {
    const result = await db.query<AccessTypeRow>(
      `${selectAccessTypes} WHERE is_active = TRUE ORDER BY name`,
    );
    res.json({ accessTypes: result.rows });
  });

  router.get("/admin", requireAdmin, async (_req, res) => {
    const result = await db.query<AccessTypeRow>(`${selectAccessTypes} ORDER BY name`);
    res.json({ accessTypes: result.rows });
  });

  router.post("/", requireAdmin, async (req, res) => {
    const input = createSchema.parse(req.body);
    const result = await db.query<AccessTypeRow>(
      `INSERT INTO access_types (name, description, icon)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, icon, is_active AS "isActive", created_at AS "createdAt"`,
      [input.name, input.description, input.icon],
    );
    res.status(201).json({ accessType: result.rows[0] });
  });

  router.patch("/:id", requireAdmin, async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const input = updateSchema.parse(req.body);
    if (Object.keys(input).length === 0) {
      throw new AppError(400, "At least one field must be supplied", "EMPTY_UPDATE");
    }

    const existing = await db.query<AccessTypeRow>(`${selectAccessTypes} WHERE id = $1`, [id]);
    if (!existing.rows[0]) throw new AppError(404, "Access type was not found", "NOT_FOUND");
    const current = existing.rows[0];
    const result = await db.query<AccessTypeRow>(
      `UPDATE access_types
       SET name = $2, description = $3, icon = $4, is_active = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, description, icon, is_active AS "isActive", created_at AS "createdAt"`,
      [
        id,
        input.name ?? current.name,
        input.description ?? current.description,
        input.icon ?? current.icon,
        input.isActive ?? current.isActive,
      ],
    );
    res.json({ accessType: result.rows[0] });
  });

  router.delete("/:id", requireAdmin, async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const result = await db.query(
      "UPDATE access_types SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id",
      [id],
    );
    if (!result.rowCount) throw new AppError(404, "Access type was not found", "NOT_FOUND");
    res.status(204).send();
  });

  return router;
}

