# AccessFlow API Technical Reference

This document explains what every AccessFlow API endpoint does, who may call it, what data it expects, and how it affects the database and approval workflow.

## 1. API basics

When the application is started with Docker Compose, the browser and API are available through:

```text
Application: http://localhost:8088
API base URL: http://localhost:8088/api
```

When the backend is run directly for development, its default API base URL is:

```text
http://localhost:3000/api
```

All request and response bodies use JSON unless an endpoint returns no content.

### Authentication header

Except for login and the health check, every endpoint requires the JWT returned by the login endpoint:

```http
Authorization: Bearer <token>
```

The API verifies the token signature, expiry, user ID, email, and role. A missing token returns `401 UNAUTHENTICATED`; an invalid or expired token returns `401 INVALID_TOKEN`.

### Roles

| Role | Main responsibility |
| --- | --- |
| `USER` | Submit, view, edit, and withdraw their own access requests. |
| `MANAGER` | Review requests from users directly assigned to them. |
| `ADMIN` | Review manager-approved requests and manage the access catalog. |

Role checks are performed by the backend. Hiding a button in the frontend is only a user-interface convenience and is not treated as security.

### Standard error format

Application errors have a consistent shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "A readable explanation"
  }
}
```

Validation failures also include a `details` array describing the invalid fields. Common HTTP status codes are:

| Status | Meaning |
| --- | --- |
| `200` | The operation succeeded. |
| `201` | A record was created. |
| `204` | The operation succeeded and has no response body. |
| `400` | The submitted body, path parameter, or query data is invalid. |
| `401` | Authentication is missing, invalid, or expired. |
| `403` | The signed-in user is authenticated but is not allowed to perform the operation. |
| `404` | The requested record does not exist or is unavailable. |
| `409` | The record exists, but its current workflow state does not allow the operation. |
| `422` | The request is valid JSON but a required business relationship is missing. |
| `429` | Too many login attempts were made. |
| `500` | An unexpected server error occurred. |

## 2. Workflow concepts

An access request uses both a public `status` and an internal approval `stage`.

| Status | Meaning |
| --- | --- |
| `IN_PROGRESS` | The request is still waiting for a required decision. |
| `APPROVED` | Both the assigned manager and an admin approved it. |
| `REJECTED` | A manager or admin rejected it. |
| `CANCELLED` | The requester withdrew it before manager review. |

| Stage | Meaning |
| --- | --- |
| `MANAGER` | Waiting for the requester's assigned manager. |
| `ADMIN` | Manager approved; waiting for an admin. |
| `COMPLETE` | No more decisions are allowed. |

The valid transitions are:

```text
User submits
    -> IN_PROGRESS / MANAGER

Manager approves
    -> IN_PROGRESS / ADMIN

Manager rejects
    -> REJECTED / COMPLETE

Admin approves
    -> APPROVED / COMPLETE

Admin rejects
    -> REJECTED / COMPLETE
```

The request does **not** become `APPROVED` after manager approval. This is intentional because the assessment requires both approval levels.

## 3. Common response objects

### User object

```json
{
  "id": "UUID",
  "email": "employee@accessflow.local",
  "fullName": "Employee Name",
  "role": "USER",
  "managerId": "UUID",
  "managerName": "Manager Name"
}
```

Password hashes are never returned by the API.

### Access type object

```json
{
  "id": "UUID",
  "name": "VPN Access",
  "description": "Secure access to internal company resources.",
  "icon": "shield",
  "isActive": true,
  "createdAt": "2026-09-14T10:00:00.000Z"
}
```

### Request object

```json
{
  "id": "UUID",
  "requestNumber": "AR-2026-A1B2C3",
  "requesterId": "UUID",
  "requesterName": "Employee Name",
  "requesterEmail": "employee@accessflow.local",
  "managerId": "UUID",
  "managerName": "Manager Name",
  "accessTypeId": "UUID",
  "accessName": "VPN Access",
  "accessIcon": "shield",
  "reason": "I need VPN access for remote development.",
  "status": "IN_PROGRESS",
  "stage": "MANAGER",
  "createdAt": "2026-09-14T10:00:00.000Z",
  "updatedAt": "2026-09-14T10:00:00.000Z"
}
```

`requestNumber` is the human-readable business identifier shown in the UI. `id` is the UUID used in API paths and database relationships.

## 4. Endpoint summary

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Check that the API and database are healthy. |
| `POST` | `/api/auth/login` | Public | Verify credentials and issue a JWT. |
| `GET` | `/api/auth/me` | Any role | Return the currently authenticated user. |
| `GET` | `/api/access-types` | Any role | List active access options available for requests. |
| `GET` | `/api/access-types/admin` | Admin | List active and inactive access types. |
| `POST` | `/api/access-types` | Admin | Create an access type. |
| `PATCH` | `/api/access-types/:id` | Admin | Update an access type. |
| `DELETE` | `/api/access-types/:id` | Admin | Disable an access type with a soft delete. |
| `POST` | `/api/requests` | Authenticated requester | Create an access request. |
| `GET` | `/api/requests/mine` | Any role | List requests submitted by the current user. |
| `GET` | `/api/requests/approvals` | Manager or admin | List only requests currently assigned to the reviewer. |
| `GET` | `/api/requests/:id` | Authorized viewer | Return one request and its approval history. |
| `PATCH` | `/api/requests/:id` | Request owner | Edit the reason before manager review. |
| `DELETE` | `/api/requests/:id` | Request owner | Withdraw a request before manager review. |
| `POST` | `/api/requests/:id/decision` | Assigned manager or admin | Approve or reject the current workflow stage. |
| `GET` | `/api/dashboard` | Any role | Return role-scoped dashboard counts and recent activity. |

## 5. Health API

### `GET /api/health`

**What it does:** Executes a simple database query and confirms that both the Express API and PostgreSQL connection are working. Docker also uses this endpoint for the backend health check.

**Authentication:** None.

**Success — `200 OK`:**

```json
{
  "status": "ok"
}
```

If the database query fails, the centralized error handler returns `500` and the container health check fails.

## 6. Authentication APIs

### `POST /api/auth/login`

**What it does:** Finds an active user by email, compares the submitted password with the stored bcrypt hash, and issues a signed JWT containing the user's ID, email, and role.

**Authentication:** None.

**Request body:**

```json
{
  "email": "employee@accessflow.local",
  "password": "Password123!"
}
```

The email is trimmed and converted to lowercase. The password is never stored or logged by this endpoint.

**Success — `200 OK`:**

```json
{
  "token": "signed.jwt.value",
  "user": {
    "id": "UUID",
    "email": "employee@accessflow.local",
    "fullName": "Employee Name",
    "role": "USER",
    "managerId": "UUID",
    "managerName": "Manager Name"
  }
}
```

**Important errors:**

- `401 INVALID_CREDENTIALS`: email or password is incorrect, or the account is inactive.
- `429`: more than 10 login attempts were made from the same source within 15 minutes.

Returning the same credential error for an unknown email and a wrong password avoids revealing which accounts exist.

### `GET /api/auth/me`

**What it does:** Reloads the current active user from the database using the identity in the JWT. The frontend uses it to restore and verify a signed-in session.

**Authentication:** Any authenticated role.

**Success — `200 OK`:**

```json
{
  "user": {
    "id": "UUID",
    "email": "employee@accessflow.local",
    "fullName": "Employee Name",
    "role": "USER",
    "managerId": "UUID",
    "managerName": "Manager Name"
  }
}
```

**Important error:** `401 UNAUTHENTICATED` if the user was removed or deactivated after the token was issued.

## 7. Access catalog APIs

The access catalog contains the options shown on the Request Access page, such as VPN, GitHub/GitLab, Figma, and Jira.

### `GET /api/access-types`

**What it does:** Returns active access types, sorted alphabetically. Disabled types are deliberately hidden so users cannot create new requests for them.

**Authentication:** Any authenticated role.

**Success — `200 OK`:**

```json
{
  "accessTypes": [
    {
      "id": "UUID",
      "name": "VPN Access",
      "description": "Secure access to internal company resources.",
      "icon": "shield",
      "isActive": true,
      "createdAt": "2026-09-14T10:00:00.000Z"
    }
  ]
}
```

### `GET /api/access-types/admin`

**What it does:** Returns the complete catalog, including disabled entries. This allows an admin interface to inspect and reactivate existing catalog records.

**Authentication:** `ADMIN` only.

**Important error:** `403 FORBIDDEN` for a user or manager.

### `POST /api/access-types`

**What it does:** Creates a new active access option.

**Authentication:** `ADMIN` only.

**Request body:**

```json
{
  "name": "Database Access",
  "description": "Read-only access to the reporting database.",
  "icon": "database"
}
```

Validation rules:

- `name`: 2–80 characters.
- `description`: 5–240 characters.
- `icon`: `shield`, `code`, `palette`, `ticket`, `database`, or `key`. If omitted, `key` is used.

**Success — `201 Created`:** Returns `{ "accessType": ... }` containing the created record.

### `PATCH /api/access-types/:id`

**What it does:** Partially updates an access type. It can change the displayed name, description, icon, or active state.

**Authentication:** `ADMIN` only.

**Path parameter:** `id` must be the access type UUID.

**Example request body:**

```json
{
  "description": "Updated description for reviewers and requesters.",
  "isActive": false
}
```

At least one supported field must be provided. The API preserves every omitted value.

**Success — `200 OK`:** Returns `{ "accessType": ... }` containing the updated record.

**Important errors:**

- `400 EMPTY_UPDATE`: no supported fields were supplied.
- `404 NOT_FOUND`: the UUID does not match an access type.

### `DELETE /api/access-types/:id`

**What it does:** Soft-deletes an access type by setting `is_active` to `false`. It does not physically delete the row because older access requests may still reference it.

**Authentication:** `ADMIN` only.

**Success — `204 No Content`:** No response body.

**Important error:** `404 NOT_FOUND` if the access type does not exist.

## 8. Access request APIs

### `POST /api/requests`

**What it does:** Creates a new request for the authenticated user. The requester ID is taken from the JWT, never from the request body, preventing one user from creating a request in another user's name.

**Authentication:** Required. It is intended for `USER` accounts, and the authenticated account must have an assigned manager.

**Request body:**

```json
{
  "accessTypeId": "UUID",
  "reason": "I need VPN access to support the production release remotely."
}
```

Validation and database behavior:

- `accessTypeId` must be a valid UUID for an active access type.
- `reason` is trimmed and must contain 10–1000 characters.
- The API confirms that the current user is active and has a manager.
- It generates a readable number such as `AR-2026-A1B2C3`.
- PostgreSQL creates the request at `IN_PROGRESS / MANAGER`.

**Success — `201 Created`:** Returns `{ "request": ... }` containing the newly created request.

**Important errors:**

- `404 ACCESS_NOT_FOUND`: the selected type does not exist or is disabled.
- `422 NO_MANAGER`: the current account has no assigned manager.

### `GET /api/requests/mine`

**What it does:** Returns every request submitted by the authenticated user, newest first. This powers the My Requests page and includes completed, rejected, and withdrawn requests.

**Authentication:** Any authenticated role.

**Success — `200 OK`:**

```json
{
  "requests": [
    {
      "id": "UUID",
      "requestNumber": "AR-2026-A1B2C3",
      "accessName": "VPN Access",
      "reason": "I need VPN access to support the production release remotely.",
      "status": "IN_PROGRESS",
      "stage": "MANAGER",
      "createdAt": "2026-09-14T10:00:00.000Z"
    }
  ]
}
```

The actual objects also include the other fields shown in the common Request object.

### `GET /api/requests/approvals`

**What it does:** Returns only the in-progress requests that the signed-in reviewer is allowed to decide now. It powers the Approve Requests page.

**Authentication and filtering:**

- A `MANAGER` receives only `MANAGER`-stage requests from users whose `manager_id` equals that manager's user ID.
- An `ADMIN` receives only `ADMIN`-stage requests, meaning the manager has already approved them.
- A requester never receives their own request in an approval queue.
- A normal `USER` receives an empty list.
- Results are ordered oldest first so earlier submissions can be reviewed first.

**Success — `200 OK`:** Returns `{ "requests": [...] }`.

This endpoint filters the visible queue, but the decision endpoint independently repeats the authorization checks. A malicious client therefore cannot approve an unassigned request merely by guessing its UUID.

### `GET /api/requests/:id`

**What it does:** Returns one request together with its chronological approval audit history.

**Authentication:** The viewer must be one of:

- The user who submitted the request.
- The manager directly assigned to that requester.
- An admin.

**Success — `200 OK`:**

```json
{
  "request": {
    "id": "UUID",
    "requestNumber": "AR-2026-A1B2C3",
    "status": "IN_PROGRESS",
    "stage": "ADMIN"
  },
  "approvals": [
    {
      "id": "UUID",
      "level": "MANAGER",
      "action": "APPROVE",
      "comment": "Business need confirmed.",
      "approverName": "Manager Name",
      "decidedAt": "2026-09-14T10:15:00.000Z"
    }
  ]
}
```

The actual request contains the full common Request object.

**Important errors:**

- `403 FORBIDDEN`: the user is not the requester, assigned manager, or an admin.
- `404 NOT_FOUND`: the request does not exist.

### `PATCH /api/requests/:id`

**What it does:** Changes the reason on the requester's own request.

**Authentication and workflow rule:** Only the original requester may edit it, and only while it is `IN_PROGRESS / MANAGER`. Once the manager has acted, its audit meaning must remain stable, so editing is blocked.

**Request body:**

```json
{
  "reason": "Updated business reason with the required project details."
}
```

The reason must contain 10–1000 characters after trimming.

**Success — `200 OK`:** Returns `{ "request": ... }` containing the updated request.

**Important error:** `409 NOT_EDITABLE` if the request is not owned by the caller or is no longer awaiting manager review. The combined response intentionally avoids exposing details about another user's request.

### `DELETE /api/requests/:id`

**What it does:** Withdraws the requester's own request. This is a soft delete: the record is retained for history, its status becomes `CANCELLED`, and its stage becomes `COMPLETE`.

**Authentication and workflow rule:** Only the original requester may withdraw it, and only while it is `IN_PROGRESS / MANAGER`.

**Success — `204 No Content`:** No response body.

**Important error:** `409 NOT_CANCELLABLE` if it is not the caller's request or the manager has already acted.

### `POST /api/requests/:id/decision`

**What it does:** Records a manager or admin approval decision and advances or completes the workflow.

**Request body:**

```json
{
  "decision": "APPROVE",
  "comment": "The access is required for the assigned project."
}
```

Validation rules:

- `decision` must be `APPROVE` or `REJECT`.
- `comment` is optional and may contain up to 500 characters.

**Authorization and transition rules:**

- At `MANAGER`, the caller must have the `MANAGER` role and their ID must exactly match the requester's assigned manager.
- At `ADMIN`, the caller must have the `ADMIN` role.
- A requester cannot approve their own request.
- A completed, rejected, approved, or cancelled request cannot be decided again.

**Database behavior:** The endpoint runs inside a PostgreSQL transaction and locks the request row with `FOR UPDATE`. It inserts an immutable approval audit record and updates the request state as one atomic operation. The lock prevents two reviewers from making conflicting decisions at the same time.

**Success — `200 OK`:** Returns `{ "request": ... }` with the new status and stage.

**Important errors:**

- `403 SELF_APPROVAL`: the requester attempted to decide their own request.
- `403 NOT_ASSIGNED`: a manager attempted to decide another manager's request.
- `403 FORBIDDEN`: the caller's role cannot decide the current stage.
- `404 NOT_FOUND`: the request does not exist.
- `409 FINAL_REQUEST`: the request has already reached a final state.

## 9. Dashboard API

### `GET /api/dashboard`

**What it does:** Calculates live summary metrics from PostgreSQL and returns the five most recent requests visible to the current user. The frontend refreshes this endpoint periodically, so a newly submitted request appears without seeded request data.

**Authentication:** Any authenticated role.

**Role-based scope:**

| Role | Returned scope | Included requests |
| --- | --- | --- |
| `USER` | `PERSONAL` | Only requests submitted by that user. |
| `MANAGER` | `TEAM` | Only requests from users directly assigned to that manager. |
| `ADMIN` | `SYSTEM` | All requests in the system. |

**Success — `200 OK`:**

```json
{
  "scope": "TEAM",
  "metrics": {
    "totalRequests": 1,
    "inProgress": 1,
    "managerPending": 1,
    "adminPending": 0,
    "approved": 0,
    "rejected": 0,
    "cancelled": 0
  },
  "recent": [
    {
      "id": "UUID",
      "requestNumber": "AR-2026-A1B2C3",
      "accessName": "VPN Access",
      "requesterName": "Employee Name",
      "status": "IN_PROGRESS",
      "stage": "MANAGER",
      "createdAt": "2026-09-14T10:00:00.000Z"
    }
  ]
}
```

The manager dashboard starts at zero because no requests are seeded. When an employee assigned to that manager creates a request, the manager's `TEAM` totals and recent list are calculated from that new database row.

## 10. End-to-end API example

The following sequence demonstrates why the final approval requires two decisions:

1. Employee logs in using `POST /api/auth/login` and saves the returned token.
2. Employee loads active choices using `GET /api/access-types`.
3. Employee submits using `POST /api/requests`; the result is `IN_PROGRESS / MANAGER`.
4. Assigned manager logs in and loads `GET /api/requests/approvals`.
5. Manager sends `APPROVE` to `POST /api/requests/:id/decision`; the result is still `IN_PROGRESS`, now at `ADMIN`.
6. Admin logs in and sees the request through `GET /api/requests/approvals`.
7. Admin sends `APPROVE` to the decision endpoint; the result becomes `APPROVED / COMPLETE`.
8. Employee sees the final state through `GET /api/requests/mine` or `GET /api/requests/:id`.

If either reviewer sends `REJECT`, the request immediately becomes `REJECTED / COMPLETE` and cannot advance further.

## 11. Why the API is designed this way

- **JWT identity instead of client-supplied user IDs:** prevents impersonation when creating or updating records.
- **Backend role and ownership checks:** prevents bypassing permissions with browser developer tools or direct HTTP calls.
- **Manager assignment in the database:** makes “my team” an enforceable relationship rather than a frontend filter.
- **Separate status and stage:** lets the user see a simple status while the system still knows which approval is pending.
- **Transactions and row locks for decisions:** keep the request state and approval audit record consistent under concurrent use.
- **Soft deletion:** preserves history and foreign-key relationships for auditability.
- **Parameterized SQL and Zod validation:** protect query execution and reject malformed inputs at the API boundary.
- **Fresh dashboard queries:** make newly created requests visible without relying on hard-coded or seeded request counts.

## 12. Source-code map

| Concern | Main implementation |
| --- | --- |
| Express setup and health endpoint | `backend/src/app.ts` |
| Login and current-user endpoints | `backend/src/routes/auth.ts` |
| JWT and role middleware | `backend/src/middleware/auth.ts` |
| Access catalog endpoints | `backend/src/routes/access-types.ts` |
| Request CRUD and decisions | `backend/src/routes/requests.ts` |
| Approval state machine | `backend/src/services/workflow.ts` |
| Dashboard scopes and metrics | `backend/src/routes/dashboard.ts` |
| Central error responses | `backend/src/middleware/error-handler.ts` |
| Database schema | `database/migrations/001_schema.sql` |
| Initial users and access catalog | `database/migrations/002_seed.sql` |
| Machine-readable API contract | `docs/openapi.yaml` |

The seed creates accounts and the four required access types, but it creates no access requests or approvals. Operational request data is produced only when a user submits through the application or API.
