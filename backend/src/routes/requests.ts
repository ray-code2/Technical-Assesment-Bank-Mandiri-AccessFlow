import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { Database, QueryExecutor } from "../database/db.js";
import { AppError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { decideWorkflow, type ApprovalStage, type RequestStatus } from "../services/workflow.js";

interface RequestRow {
  id: string;
  requestNumber: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  managerId: string | null;
  managerName: string | null;
  accessTypeId: string;
  accessName: string;
  accessIcon: string;
  reason: string;
  status: RequestStatus;
  stage: ApprovalStage;
  createdAt: Date;
  updatedAt: Date;
}

interface ApprovalRow {
  id: string;
  level: "MANAGER" | "ADMIN";
  action: "APPROVE" | "REJECT";
  comment: string | null;
  approverName: string;
  decidedAt: Date;
}

const createSchema = z.object({
  accessTypeId: z.string().uuid(),
  reason: z.string().trim().min(10, "Please provide at least 10 characters").max(1000),
});

const updateSchema = z.object({
  reason: z.string().trim().min(10, "Please provide at least 10 characters").max(1000),
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().trim().max(500).optional(),
});

const selectRequests = `
  SELECT ar.id, ar.request_number AS "requestNumber", ar.requester_id AS "requesterId",
         requester.full_name AS "requesterName", requester.email AS "requesterEmail",
         requester.manager_id AS "managerId", manager.full_name AS "managerName",
         at.id AS "accessTypeId", at.name AS "accessName", at.icon AS "accessIcon",
         ar.reason, ar.status, ar.stage, ar.created_at AS "createdAt", ar.updated_at AS "updatedAt"
  FROM access_requests ar
  JOIN users requester ON requester.id = ar.requester_id
  LEFT JOIN users manager ON manager.id = requester.manager_id
  JOIN access_types at ON at.id = ar.access_type_id
`;

async function findRequest(db: QueryExecutor, id: string, lock = false) {
  const result = await db.query<RequestRow>(
    `${selectRequests} WHERE ar.id = $1 ${lock ? "FOR UPDATE OF ar" : ""}`,
    [id],
  );
  return result.rows[0];
}

function assertCanView(request: RequestRow, actor: Express.Request["auth"]) {
  const isAssignedManager = actor!.role === "MANAGER" && request.managerId === actor!.userId;
  if (
    request.requesterId !== actor!.userId &&
    !isAssignedManager &&
    actor!.role !== "ADMIN"
  ) {
    throw new AppError(403, "You are not allowed to view this request", "FORBIDDEN");
  }
}

export function requestsRouter(db: Database) {
  const router = Router();
  router.use(requireAuth);

  router.post("/", async (req, res) => {
    const input = createSchema.parse(req.body);
    const [userResult, accessResult] = await Promise.all([
      db.query<{ managerId: string | null }>(
        'SELECT manager_id AS "managerId" FROM users WHERE id = $1 AND is_active = TRUE',
        [req.auth!.userId],
      ),
      db.query("SELECT id FROM access_types WHERE id = $1 AND is_active = TRUE", [input.accessTypeId]),
    ]);

    if (!userResult.rows[0]?.managerId) {
      throw new AppError(422, "A manager must be assigned before you can request access", "NO_MANAGER");
    }
    if (!accessResult.rowCount) {
      throw new AppError(404, "The selected access is not available", "ACCESS_NOT_FOUND");
    }

    const requestNumber = `AR-${new Date().getUTCFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO access_requests (request_number, requester_id, access_type_id, reason)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [requestNumber, req.auth!.userId, input.accessTypeId, input.reason],
    );
    const request = await findRequest(db, inserted.rows[0]!.id);
    res.status(201).json({ request });
  });

  router.get("/mine", async (req, res) => {
    const result = await db.query<RequestRow>(
      `${selectRequests} WHERE ar.requester_id = $1 ORDER BY ar.created_at DESC`,
      [req.auth!.userId],
    );
    res.json({ requests: result.rows });
  });

  router.get("/approvals", async (req, res) => {
    const result = await db.query<RequestRow>(
      `${selectRequests}
       WHERE ar.status = 'IN_PROGRESS'
         AND ar.requester_id <> $1
         AND ((ar.stage = 'MANAGER' AND requester.manager_id = $1 AND $2 = 'MANAGER')
           OR (ar.stage = 'ADMIN' AND $2 = 'ADMIN'))
       ORDER BY ar.created_at ASC`,
      [req.auth!.userId, req.auth!.role],
    );
    res.json({ requests: result.rows });
  });

  router.get("/:id", async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const request = await findRequest(db, id);
    if (!request) throw new AppError(404, "Request was not found", "NOT_FOUND");
    assertCanView(request, req.auth);
    const approvals = await db.query<ApprovalRow>(
      `SELECT a.id, a.level, a.action, a.comment, approver.full_name AS "approverName",
              a.decided_at AS "decidedAt"
       FROM approvals a
       JOIN users approver ON approver.id = a.approver_id
       WHERE a.request_id = $1 ORDER BY a.decided_at`,
      [id],
    );
    res.json({ request, approvals: approvals.rows });
  });

  router.patch("/:id", async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const input = updateSchema.parse(req.body);
    const result = await db.query<{ id: string }>(
      `UPDATE access_requests
       SET reason = $3, updated_at = NOW(), version = version + 1
       WHERE id = $1 AND requester_id = $2 AND status = 'IN_PROGRESS' AND stage = 'MANAGER'
       RETURNING id`,
      [id, req.auth!.userId, input.reason],
    );
    if (!result.rowCount) {
      throw new AppError(409, "Only your requests waiting for manager approval can be edited", "NOT_EDITABLE");
    }
    res.json({ request: await findRequest(db, id) });
  });

  router.delete("/:id", async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const result = await db.query(
      `UPDATE access_requests
       SET status = 'CANCELLED', stage = 'COMPLETE', cancelled_at = NOW(),
           updated_at = NOW(), version = version + 1
       WHERE id = $1 AND requester_id = $2 AND status = 'IN_PROGRESS' AND stage = 'MANAGER'
       RETURNING id`,
      [id, req.auth!.userId],
    );
    if (!result.rowCount) {
      throw new AppError(409, "Only your requests waiting for manager approval can be withdrawn", "NOT_CANCELLABLE");
    }
    res.status(204).send();
  });

  router.post("/:id/decision", async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const input = decisionSchema.parse(req.body);

    const request = await db.transaction(async (client) => {
      const current = await findRequest(client, id, true);
      if (!current) throw new AppError(404, "Request was not found", "NOT_FOUND");

      const next = decideWorkflow({
        status: current.status,
        stage: current.stage,
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        requesterId: current.requesterId,
        managerId: current.managerId,
        decision: input.decision,
      });

      await client.query(
        `INSERT INTO approvals (request_id, level, approver_id, action, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, next.approvalLevel, req.auth!.userId, input.decision, input.comment || null],
      );
      await client.query(
        `UPDATE access_requests
         SET status = $2, stage = $3, updated_at = NOW(), version = version + 1
         WHERE id = $1`,
        [id, next.status, next.stage],
      );
      return findRequest(client, id);
    });

    res.json({ request });
  });

  return router;
}
