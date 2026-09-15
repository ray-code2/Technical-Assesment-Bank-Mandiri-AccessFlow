import { describe, expect, it } from "vitest";
import { AppError } from "../errors.js";
import { decideWorkflow } from "./workflow.js";

const base = {
  status: "IN_PROGRESS" as const,
  actorId: "00000000-0000-4000-8000-000000000002",
  actorRole: "MANAGER" as const,
  requesterId: "00000000-0000-4000-8000-000000000001",
  managerId: "00000000-0000-4000-8000-000000000002",
};

describe("two-level approval workflow", () => {
  it("moves manager-approved requests to admin without marking them approved", () => {
    expect(decideWorkflow({ ...base, stage: "MANAGER", decision: "APPROVE" })).toEqual({
      status: "IN_PROGRESS",
      stage: "ADMIN",
      approvalLevel: "MANAGER",
    });
  });

  it("makes a manager rejection final", () => {
    expect(decideWorkflow({ ...base, stage: "MANAGER", decision: "REJECT" })).toEqual({
      status: "REJECTED",
      stage: "COMPLETE",
      approvalLevel: "MANAGER",
    });
  });

  it("allows an admin to grant final approval", () => {
    expect(
      decideWorkflow({ ...base, stage: "ADMIN", actorRole: "ADMIN", decision: "APPROVE" }),
    ).toEqual({ status: "APPROVED", stage: "COMPLETE", approvalLevel: "ADMIN" });
  });

  it("makes an admin rejection final", () => {
    expect(
      decideWorkflow({ ...base, stage: "ADMIN", actorRole: "ADMIN", decision: "REJECT" }),
    ).toEqual({ status: "REJECTED", stage: "COMPLETE", approvalLevel: "ADMIN" });
  });

  it("rejects a decision by the wrong manager", () => {
    expect(() =>
      decideWorkflow({ ...base, stage: "MANAGER", actorId: crypto.randomUUID(), decision: "APPROVE" }),
    ).toThrowError(AppError);
  });

  it("requires the explicit manager role even when the team relationship matches", () => {
    expect(() =>
      decideWorkflow({ ...base, stage: "MANAGER", actorRole: "USER", decision: "APPROVE" }),
    ).toThrow("Only a manager");
  });

  it("rejects non-admin decisions at the admin stage", () => {
    expect(() => decideWorkflow({ ...base, stage: "ADMIN", decision: "APPROVE" })).toThrow(
      "Only an administrator",
    );
  });

  it("prevents self-approval and changes to final requests", () => {
    expect(() =>
      decideWorkflow({
        ...base,
        stage: "MANAGER",
        actorId: base.requesterId,
        managerId: base.requesterId,
        decision: "APPROVE",
      }),
    ).toThrow("cannot approve your own");
    expect(() =>
      decideWorkflow({ ...base, status: "APPROVED", stage: "COMPLETE", decision: "APPROVE" }),
    ).toThrow("final state");
  });
});
