import { AppError } from "../errors.js";

export type RequestStatus = "IN_PROGRESS" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ApprovalStage = "MANAGER" | "ADMIN" | "COMPLETE";
export type Decision = "APPROVE" | "REJECT";

export interface WorkflowInput {
  status: RequestStatus;
  stage: ApprovalStage;
  actorId: string;
  actorRole: "USER" | "MANAGER" | "ADMIN";
  requesterId: string;
  managerId: string | null;
  decision: Decision;
}

export interface WorkflowResult {
  status: RequestStatus;
  stage: ApprovalStage;
  approvalLevel: "MANAGER" | "ADMIN";
}

export function decideWorkflow(input: WorkflowInput): WorkflowResult {
  if (input.status !== "IN_PROGRESS" || input.stage === "COMPLETE") {
    throw new AppError(409, "This request has already reached a final state", "FINAL_REQUEST");
  }

  if (input.actorId === input.requesterId) {
    throw new AppError(403, "You cannot approve your own access request", "SELF_APPROVAL");
  }

  if (input.stage === "MANAGER") {
    if (input.actorRole !== "MANAGER") {
      throw new AppError(403, "Only a manager can complete this approval", "FORBIDDEN");
    }
    if (!input.managerId || input.actorId !== input.managerId) {
      throw new AppError(403, "This request is not assigned to you", "NOT_ASSIGNED");
    }
    return input.decision === "REJECT"
      ? { status: "REJECTED", stage: "COMPLETE", approvalLevel: "MANAGER" }
      : { status: "IN_PROGRESS", stage: "ADMIN", approvalLevel: "MANAGER" };
  }

  if (input.actorRole !== "ADMIN") {
    throw new AppError(403, "Only an administrator can complete this approval", "FORBIDDEN");
  }

  return input.decision === "REJECT"
    ? { status: "REJECTED", stage: "COMPLETE", approvalLevel: "ADMIN" }
    : { status: "APPROVED", stage: "COMPLETE", approvalLevel: "ADMIN" };
}
