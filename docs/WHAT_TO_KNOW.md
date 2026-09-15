# AccessFlow: what you should know and explain

Use this page to prepare for a technical assessment presentation. Start with the non-technical explanation. Add technical detail only when the reviewer asks for it.

## 1. Thirty-second explanation

> AccessFlow is an employee access-request system. An employee requests access to a company resource and explains why it is needed. Their assigned manager reviews the request first. If the manager approves, an administrator performs the final review. The request becomes approved only after both approvals. Every user sees only the information and actions allowed by their role.

## 2. The business problem

Companies need a controlled way to grant access to resources such as VPN, source-code repositories, Figma, and Jira. Granting access informally through chat or email creates several problems:

- Requests can be lost or forgotten.
- It is unclear who approved the access.
- Employees may receive access without the correct manager's approval.
- There is no reliable history for security reviews.
- Users cannot easily see whether their request is still waiting or completed.

AccessFlow solves this with one visible, auditable workflow.

## 3. The three personas

### User

The user can:

- Sign in with an existing account.
- View the available access catalog.
- Select an access type and provide a reason.
- Submit and track requests.
- Edit or withdraw a request before the manager decides.
- See whether a request is waiting, approved, rejected, or withdrawn.

### Manager

The manager can:

- See dashboard metrics for direct reports.
- See requests assigned to them from their team.
- Approve or reject only manager-stage requests from direct reports.
- Add a decision note for the audit history.

The `MANAGER` role alone is not sufficient. The requester must also have that manager's ID as `manager_id`. This prevents one manager from approving another team's requests.

### Administrator

The administrator can:

- See organization-wide dashboard metrics.
- See requests already approved by a manager.
- Give the final approval or reject the request.
- Create, disable, and restore access-catalog entries.

## 4. The approval workflow

```text
User submits request
        |
        v
IN_PROGRESS / MANAGER
        |
        +-- Manager rejects --> REJECTED / COMPLETE
        |
        +-- Manager approves
                 |
                 v
        IN_PROGRESS / ADMIN
                 |
                 +-- Admin rejects --> REJECTED / COMPLETE
                 |
                 +-- Admin approves --> APPROVED / COMPLETE
```

The most important rule is that manager approval does not mean the request is fully approved. It remains `IN_PROGRESS` until the administrator approves it.

## 5. Status versus stage

The application stores two related values:

- `status` tells the user the overall result: `IN_PROGRESS`, `APPROVED`, `REJECTED`, or `CANCELLED`.
- `stage` tells the system who must act next: `MANAGER`, `ADMIN`, or `COMPLETE`.

This is better than using only a status because `IN_PROGRESS` alone cannot tell us whether the manager or administrator is expected to act.

## 6. Technical architecture

```text
Browser
  |
  v
React + TypeScript frontend
  |
  | HTTPS/JSON REST requests
  v
Nginx reverse proxy
  |
  v
Express + TypeScript backend API
  |
  | Parameterized SQL and transactions
  v
PostgreSQL database
```

### Frontend

- React renders the pages and interactive components.
- React Router handles client-side navigation.
- TanStack Query loads server data, caches it, and refreshes affected pages after changes.
- The dashboard polls every 15 seconds for updated metrics.
- TypeScript helps catch incorrect data shapes during development.
- Custom responsive CSS provides the design without adding a large UI framework.

### Backend

- Express exposes REST endpoints under `/api`.
- Zod validates request bodies, URL IDs, lengths, and enum values.
- Authentication middleware validates JSON Web Tokens.
- Authorization is enforced on the server, not only by hiding frontend buttons.
- A central error handler returns consistent status codes and error objects.

### Database

- PostgreSQL stores users, access types, requests, and approval history.
- SQL migrations create and update the schema in a repeatable order.
- Foreign keys prevent references to missing users or access types.
- Enums restrict role, status, stage, and decision values.
- Check constraints prevent impossible status/stage combinations.
- Indexes support request history and approval-queue queries.

## 7. Database tables

### `users`

Stores identity, password hash, role, active status, and the user's assigned manager.

Important fields:

- `id`
- `email`
- `password_hash`
- `role`: `USER`, `MANAGER`, or `ADMIN`
- `manager_id`: identifies the user's direct manager

### `access_types`

Stores resources that employees can request, including VPN, GitHub/GitLab, Figma, and Jira. Items are disabled instead of permanently deleted so historical requests remain valid.

### `access_requests`

Stores the requester, selected access, reason, status, stage, timestamps, and version.

### `approvals`

Stores each decision separately, including:

- Request
- Approval level
- Approver
- Approve or reject action
- Optional comment
- Decision timestamp

This provides an audit trail instead of overwriting the previous decision.

## 8. Authentication and authorization

### Authentication

Authentication answers: **Who is this user?**

1. The user submits an email and password.
2. The API loads the existing account.
3. bcrypt compares the password with the stored hash.
4. The API returns a signed, expiring JWT.
5. Protected requests send that token in the `Authorization` header.

There is no registration page because the assessment states that accounts already exist.

### Authorization

Authorization answers: **What is this user allowed to do?**

- Users can read and change only their own early-stage requests.
- Managers need the `MANAGER` role and the correct team relationship.
- Administrators can decide only requests at the admin stage.
- Nobody can approve their own request.
- Nobody can change a request that is already final.
- Calling a protected endpoint with the wrong role returns `403 Forbidden`.

## 9. Why approval uses a database transaction

A decision performs several related operations:

1. Load and lock the current request row.
2. Check its current status and stage.
3. Check the approver's role and assignment.
4. Insert the approval-history row.
5. Update the request to its next state.
6. Commit everything together.

The API uses `SELECT ... FOR UPDATE` so two browser tabs cannot approve or reject the same stage simultaneously. If any operation fails, PostgreSQL rolls back the complete decision.

## 10. CRUD functionality

CRUD means Create, Read, Update, and Delete:

- **Create:** a user submits a new access request.
- **Read:** users view their requests; reviewers view their assigned queues.
- **Update:** a user edits the reason before manager review.
- **Delete:** a user withdraws an early-stage request.

Withdrawal is implemented as a soft deletion using `CANCELLED`. The row remains available for audit purposes instead of disappearing permanently.

The administrator's access catalog also supports create, read, update, disable, and restore operations.

## 11. Dashboard behavior

Dashboard visibility depends on role:

| Role | Dashboard scope |
| --- | --- |
| `USER` | Requests submitted by that user |
| `MANAGER` | Requests submitted by direct reports |
| `ADMIN` | All requests in the system |

The dashboard calculates totals directly from PostgreSQL:

- Total requests
- In progress
- Waiting for manager
- Waiting for administrator
- Approved
- Rejected
- Withdrawn

When Alice submits a request, Bob's team total and manager-pending total increase. An already-open dashboard refreshes automatically within 15 seconds.

## 12. Error handling

Examples of errors handled by the application:

- Incorrect login: `401 Unauthorized`
- Missing or expired token: `401 Unauthorized`
- Wrong role or assigned reviewer: `403 Forbidden`
- Missing resource: `404 Not Found`
- Already-final or non-editable request: `409 Conflict`
- User without an assigned manager: `422 Unprocessable Entity`
- Invalid input: `400 Bad Request`
- Unexpected server failure: generic `500` response without exposing internal details

The frontend displays readable error messages and disables invalid or in-progress actions.

## 13. Security decisions

You should be able to explain these points:

- Passwords are hashed with bcrypt cost 12.
- JWTs expire after eight hours.
- Login attempts are rate-limited.
- SQL values are parameterized to prevent SQL injection.
- Request data is validated in the API and constrained again in the database.
- Self-approval is forbidden.
- Server-side authorization protects every decision.
- Approval history is retained.
- Helmet adds common HTTP security headers.
- CORS allows only configured frontend origins.
- JSON body size is limited.
- Secrets are provided through environment variables rather than committed `.env` files.

## 14. Seed-data strategy

The database starts with:

- Four login accounts
- Four access types
- Zero access requests
- Zero approval records

This makes the demonstration honest: every request visible in the application was created through the request flow.

Demo password: `Password123!`

| Persona | Email |
| --- | --- |
| Employee | `alice.user@accessflow.dev` |
| Manager | `bob.manager@accessflow.dev` |
| Administrator | `carol.admin@accessflow.dev` |

The credentials are only for development and must be replaced in production.

## 15. Why Docker Compose is used

Docker Compose starts the same environment for every reviewer:

- PostgreSQL database
- Backend API
- Nginx-hosted frontend

Health checks enforce the startup order: PostgreSQL becomes healthy before the API starts, and the API becomes healthy before the frontend is considered ready.

The application starts with:

```bash
docker compose up --build
```

The site is available at <http://localhost:8088>.

## 16. Recommended demonstration sequence

1. Start the application and show that every dashboard has zero requests.
2. Sign in as Alice.
3. Open Request Access, select VPN, enter a reason, and submit.
4. Show Alice's My Requests page with “Waiting for manager.”
5. Sign in as Bob.
6. Show that Bob's team dashboard contains Alice's request.
7. Approve it and explain that it remains `IN_PROGRESS` while moving to admin.
8. Sign in as Carol.
9. Show the request in the admin approval queue.
10. Approve it and show that the final status becomes `APPROVED`.
11. Return to Alice and show the completed status.
12. If time permits, create another request and demonstrate rejection.

## 17. Short answers to likely questions

### Why did you choose React, Express, and PostgreSQL?

React provides a clear interactive frontend, Express keeps the API small and readable, and PostgreSQL provides transactions, row locking, constraints, relationships, and durable audit data. TypeScript is used across frontend and backend to reduce data-shape mistakes.

### Why not make the frontend responsible for approval permissions?

Frontend controls can be modified or bypassed. The frontend improves usability, but the API must enforce the actual security rules.

### Why have both a manager role and `manager_id`?

The role grants the ability to perform manager approvals. `manager_id` restricts that ability to the correct team. Both are necessary for least privilege.

### Why are status and stage separate?

Status communicates the overall result, while stage identifies the next reviewer. A manager-approved request is still in progress but is now at the admin stage.

### Why retain withdrawn requests?

Access governance needs an audit history. Soft cancellation supports the delete operation without destroying evidence.

### How do you prevent simultaneous decisions?

The API locks the request row and performs validation, audit insertion, and state transition in one PostgreSQL transaction.

### Is the dashboard really real-time?

Its values are calculated from current database rows on every API call. The frontend automatically requests fresh values every 15 seconds and also refreshes affected data after actions in the same session.

## 18. Honest production improvements

Do not claim this assessment project is a complete enterprise product. Explain what you would add for production:

- Corporate SSO and MFA
- Secure `HttpOnly` cookie sessions with CSRF protection
- Token revocation and refresh-token rotation
- HTTPS and managed secret storage
- Email or chat notifications
- Pagination and filtering for large request volumes
- Centralized logs, monitoring, and alerting
- Database backups and disaster recovery
- CI/CD with API integration and browser end-to-end tests
- Configurable approval chains and delegated approvers

Showing awareness of these improvements is stronger than pretending they are unnecessary.

## 19. Final presentation checklist

Before presenting, make sure you can explain:

- The business problem in plain language
- The responsibilities of all three roles
- Why manager approval is not final approval
- Status versus stage
- Manager role plus team assignment
- The four main database tables
- Authentication versus authorization
- Transaction and row-lock protection
- Soft withdrawal and audit history
- Role-scoped dashboard behavior
- Why only accounts and access types are seeded
- What you would improve before production

