const baseUrl = process.env.ACCESSFLOW_URL ?? "http://localhost:8088/api";
const password = "Password123!";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const { token, expectedStatus, ...fetchOptions } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...fetchOptions,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok && !expectedStatus) {
    throw new Error(`${options.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  if (expectedStatus) {
    assert(response.status === expectedStatus, `${path}: expected ${expectedStatus}, received ${response.status}`);
  }
  return body;
}

async function login(email, expectedRole) {
  const response = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert(response.user.role === expectedRole, `${email}: expected role ${expectedRole}, received ${response.user.role}`);
  return response.token;
}

async function submit(token, accessTypeId, reason) {
  const response = await request("/requests", {
    method: "POST",
    token,
    body: JSON.stringify({ accessTypeId, reason }),
  });
  return response.request;
}

const health = await request("/health");
assert(health.status === "ok", "Health check did not return ok");

const [employeeToken, managerToken, adminToken] = await Promise.all([
  login("alice.user@accessflow.dev", "USER"),
  login("bob.manager@accessflow.dev", "MANAGER"),
  login("carol.admin@accessflow.dev", "ADMIN"),
]);
const catalog = await request("/access-types", { token: employeeToken });
assert(catalog.accessTypes.length >= 1, "No active access types were returned");
const managerDashboardBefore = await request("/dashboard", { token: managerToken });
assert(managerDashboardBefore.scope === "TEAM", "Manager dashboard did not use team scope");

const approvalRequest = await submit(
  employeeToken,
  catalog.accessTypes[0].id,
  `Automated approval smoke test created at ${new Date().toISOString()}.`,
);
assert(approvalRequest.status === "IN_PROGRESS" && approvalRequest.stage === "MANAGER", "New request did not start at manager stage");
const managerDashboardAfter = await request("/dashboard", { token: managerToken });
assert(
  managerDashboardAfter.metrics.totalRequests === managerDashboardBefore.metrics.totalRequests + 1,
  "Manager dashboard did not include the employee's new request",
);

await request(`/requests/${approvalRequest.id}/decision`, {
  method: "POST",
  token: employeeToken,
  body: JSON.stringify({ decision: "APPROVE" }),
  expectedStatus: 403,
});
await request("/access-types/admin", { token: employeeToken, expectedStatus: 403 });

const managerDecision = await request(`/requests/${approvalRequest.id}/decision`, {
  method: "POST",
  token: managerToken,
  body: JSON.stringify({ decision: "APPROVE", comment: "Automated manager approval." }),
});
assert(managerDecision.request.status === "IN_PROGRESS" && managerDecision.request.stage === "ADMIN", "Manager approval skipped or finalized the admin stage");

const adminDecision = await request(`/requests/${approvalRequest.id}/decision`, {
  method: "POST",
  token: adminToken,
  body: JSON.stringify({ decision: "APPROVE", comment: "Automated final approval." }),
});
assert(adminDecision.request.status === "APPROVED" && adminDecision.request.stage === "COMPLETE", "Admin approval was not final");

const rejectionRequest = await submit(
  employeeToken,
  catalog.accessTypes[0].id,
  `Automated rejection smoke test created at ${new Date().toISOString()}.`,
);
const rejection = await request(`/requests/${rejectionRequest.id}/decision`, {
  method: "POST",
  token: managerToken,
  body: JSON.stringify({ decision: "REJECT", comment: "Automated rejection path." }),
});
assert(rejection.request.status === "REJECTED" && rejection.request.stage === "COMPLETE", "Manager rejection was not final");

const dashboard = await request("/dashboard", { token: adminToken });
assert(dashboard.scope === "SYSTEM" && Number.isInteger(dashboard.metrics.totalRequests), "System dashboard is invalid");

console.log("AccessFlow smoke test passed:");
console.log(`- authentication: employee, manager, admin`);
console.log(`- manager team dashboard: increased after employee request`);
console.log(`- authorization guards: self-approval 403, admin endpoint 403`);
console.log(`- approval path: MANAGER -> ADMIN -> APPROVED`);
console.log(`- rejection path: MANAGER -> REJECTED`);
console.log(`- live system dashboard: ${dashboard.metrics.totalRequests} total requests`);
