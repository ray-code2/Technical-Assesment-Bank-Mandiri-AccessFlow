import { Router } from "express";
import type { Database } from "../database/db.js";
import { requireAuth } from "../middleware/auth.js";

interface MetricRow {
  totalRequests: number;
  inProgress: number;
  managerPending: number;
  adminPending: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

interface RecentRow {
  id: string;
  requestNumber: string;
  accessName: string;
  requesterName: string;
  status: string;
  stage: string;
  createdAt: Date;
}

export function dashboardRouter(db: Database) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    const scope = req.auth!.role === "ADMIN" ? "SYSTEM" : req.auth!.role === "MANAGER" ? "TEAM" : "PERSONAL";
    const metricsVisibility =
      scope === "SYSTEM"
        ? "TRUE"
        : scope === "TEAM"
          ? "requester_id IN (SELECT id FROM users WHERE manager_id = $1)"
          : "requester_id = $1";
    const recentVisibility =
      scope === "SYSTEM"
        ? "TRUE"
        : scope === "TEAM"
          ? "requester.manager_id = $1"
          : "ar.requester_id = $1";
    const parameters = scope === "SYSTEM" ? [] : [req.auth!.userId];
    const [metrics, recent] = await Promise.all([
      db.query<MetricRow>(
        `SELECT COUNT(*)::int AS "totalRequests",
                COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS "inProgress",
                COUNT(*) FILTER (WHERE status = 'IN_PROGRESS' AND stage = 'MANAGER')::int AS "managerPending",
                COUNT(*) FILTER (WHERE status = 'IN_PROGRESS' AND stage = 'ADMIN')::int AS "adminPending",
                COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS "approved",
                COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS "rejected",
                COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS "cancelled"
         FROM access_requests WHERE ${metricsVisibility}`,
        parameters,
      ),
      db.query<RecentRow>(
        `SELECT ar.id, ar.request_number AS "requestNumber", at.name AS "accessName",
                requester.full_name AS "requesterName", ar.status, ar.stage,
                ar.created_at AS "createdAt"
         FROM access_requests ar
         JOIN access_types at ON at.id = ar.access_type_id
         JOIN users requester ON requester.id = ar.requester_id
         WHERE ${recentVisibility}
         ORDER BY ar.created_at DESC LIMIT 5`,
        parameters,
      ),
    ]);

    res.json({
      scope,
      metrics: metrics.rows[0],
      recent: recent.rows,
    });
  });

  return router;
}
