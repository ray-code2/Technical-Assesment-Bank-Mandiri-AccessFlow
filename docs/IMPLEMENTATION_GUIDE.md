# AccessFlow implementation guide

This guide explains the project from an empty directory to a complete assessment submission and gives you the reasoning to defend each decision in an interview.

## 1. Translate the PDF into acceptance criteria

The most important sentence in the assessment is that a request becomes `APPROVED` only after both approvals. That produces a strict sequence:

```text
Submitted -> Waiting for manager -> Waiting for admin -> Approved
                    |                     |
                    +---- Rejected -------+
```

The PDF only requires visible statuses `IN_PROGRESS`, `REJECTED`, and `APPROVED`. Those values cannot tell us which reviewer is next, so the model adds a separate `stage` (`MANAGER`, `ADMIN`, or `COMPLETE`). This avoids inventing non-required public statuses and makes queue queries straightforward.

## 2. Choose boundaries before screens

The application is divided into three independently understandable parts:

1. React owns presentation, navigation, forms, cache refresh, and responsive behavior.
2. Express owns authentication, authorization, validation, and workflow rules.
3. PostgreSQL owns durable state, relationships, invariants, transactions, and audit history.

This separation matters in an access-control system. Hiding an Approve button is useful UX, but only the API and database can make the rule secure.

## 3. Model people and permissions

The clarified requirements explicitly define `USER`, `MANAGER`, and `ADMIN`. The manager role and the team relationship are both modeled because they answer different security questions:

- Alice and Diego have `role = USER` and `manager_id = Bob`.
- Bob has `role = MANAGER`; he gets manager powers only for requests made by his direct reports.
- Carol has `role = ADMIN`; she can make the second decision after a manager approval.

The role answers “may this person perform manager approvals?” The relationship answers “is this particular request assigned to them?” Requiring both prevents one manager from approving another manager's team.

## 4. Make the database reject impossible states

The first migration creates enums, foreign keys, indexes, and a `valid_request_state` check constraint. It is impossible to store `APPROVED / MANAGER` or `IN_PROGRESS / COMPLETE`. Approval rows are unique by `(request_id, level)`, so a level cannot decide twice.

The queue index covers `stage`, `status`, and creation time only for in-progress requests. That matches the two frequent reviewer queries without inflating the index with completed history.

## 5. Build authentication and authorization

Login performs these steps:

1. Validate and normalize the email.
2. Fetch an active account with parameterized SQL.
3. Compare the supplied password with its bcrypt hash.
4. Return an expiring signed JWT containing the user ID, email, and global role.
5. Validate that token on every protected request.

Authorization remains contextual:

- A requester ID always comes from the token, never from the submitted JSON.
- Manager queues require `authenticatedUser.role = MANAGER` and `requester.manager_id = authenticatedUser.id`.
- Admin-stage decisions require `authenticatedUser.role = ADMIN`.
- The requester cannot decide their own request.
- Final requests cannot transition again.

## 6. Make a decision atomic

Approving is the highest-risk write. The route starts a transaction, locks the request row with `FOR UPDATE`, re-checks its current stage and reviewer, inserts the audit decision, updates the request, and commits. If any operation fails, everything rolls back.

Without the lock, two browser tabs could both read “waiting for manager” and attempt conflicting decisions. UI disabling does not solve that race; the transaction does.

## 7. Implement CRUD without destroying evidence

Users can create and read their requests. They can update a reason or withdraw only before the manager acts. HTTP `DELETE` performs a soft cancellation instead of deleting the row, because destroying an access-request record is a poor fit for auditability. The admin catalog uses the same principle: disabling an item does not break old requests.

## 8. Build the pages around user jobs

- **Login:** shows the workflow and offers one-click demo personas.
- **Dashboard:** displays every required bonus metric. Admin sees system scope, managers see requests from direct reports, and users see personal scope.
- **Request Access:** separates resource choice from business justification and makes the next reviewer explicit.
- **My Requests:** displays every required column plus stage-specific labels and safe edit/withdraw actions.
- **Approve Requests:** separates manager and admin queues and explains the effect before confirmation.
- **Access Catalog:** lets administrators manage requestable resources.

TanStack Query caches server reads and invalidates affected dashboard, history, and queue data after mutations. The dashboard also refetches every fifteen seconds, so its aggregates stay current without a manual reload.

## 9. Verify the critical behavior

Automated tests cover every state-machine transition, wrong-manager access, non-admin access, self-approval, and final-state protection. Strict TypeScript checks both applications. The production build proves that the server output and optimized SPA bundle can be created.

The live Docker verification adds evidence that static tests cannot:

- migrations run against PostgreSQL;
- all three personas can authenticate;
- an employee can create a request;
- employee self-approval returns `403`;
- manager approval returns `IN_PROGRESS / ADMIN`;
- admin approval returns `APPROVED / COMPLETE`;
- a user calling an admin endpoint receives `403`;
- dashboard counts come from real database rows.

## 10. How to explain the project in the interview

Use this short version first:

> I treated approval as a state machine, not as two booleans. Visible status answers what happened, while stage answers who acts next. A manager needs both the MANAGER role and the correct team relationship; an admin provides final approval. The frontend makes the flow clear, but the Express API enforces every permission inside a PostgreSQL transaction and writes an audit row. I chose soft cancellation because access governance should preserve evidence. Docker Compose makes the exact frontend, API, migrations, and database reproducible with one command.

Then be ready for these questions:

**Why not store `manager_approved` and `admin_approved` booleans?**  
Booleans allow ambiguous combinations and do not represent rejection, cancellation, current ownership, or completion cleanly. A constrained state machine is easier to validate and extend.

**Why check both the `MANAGER` role and `manager_id`?**  
The role grants the capability; the relationship limits its scope. This follows least privilege and prevents unrelated team approvals.

**Why raw SQL instead of an ORM?**  
For a small assessment, visible SQL communicates constraints, indexes, row locking, and exact authorization joins directly. In a larger team, a query builder or ORM could improve composition without changing the domain design.

**Why is withdrawal implemented as delete but retained?**  
The API provides RESTful CRUD semantics, while the database preserves the audit record as `CANCELLED`. Hard deletion would make investigations and metrics unreliable.

**What would you change for production?**  
Corporate SSO/MFA, secure cookie sessions and CSRF protection, secret management, HTTPS, token revocation, background notifications, richer audit export, pagination, structured observability, database backups, and full API integration/end-to-end tests in CI.

## 11. Submission checklist

- Initialize and push the Git repository.
- Keep `.env` out of Git; only `.env.example` belongs in the submission.
- Run `npm run typecheck`, `npm test`, and `npm run build` immediately before submission.
- Record the demo sequence from the README and show the terminal health checks.
- Explain the manager relationship, separate stage/status, transaction lock, and soft deletion.
- Replace any organization name or branding only if the employer requests it.
