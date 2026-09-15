import type { ApprovalStage, RequestStatus } from "../types";

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function statusLabel(status: RequestStatus, stage: ApprovalStage) {
  if (status === "IN_PROGRESS" && stage === "MANAGER") return "Waiting for manager";
  if (status === "IN_PROGRESS" && stage === "ADMIN") return "Waiting for admin";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Withdrawn";
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

