export type Role = "USER" | "MANAGER" | "ADMIN";
export type RequestStatus = "IN_PROGRESS" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ApprovalStage = "MANAGER" | "ADMIN" | "COMPLETE";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  managerId: string | null;
  managerName: string | null;
}

export interface AccessType {
  id: string;
  name: string;
  description: string;
  icon: "shield" | "code" | "palette" | "ticket" | "database" | "key";
  isActive: boolean;
  createdAt: string;
}

export interface AccessRequest {
  id: string;
  requestNumber: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  managerId: string | null;
  managerName: string | null;
  accessTypeId: string;
  accessName: string;
  accessIcon: AccessType["icon"];
  reason: string;
  status: RequestStatus;
  stage: ApprovalStage;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  scope: "SYSTEM" | "TEAM" | "PERSONAL";
  metrics: {
    totalRequests: number;
    inProgress: number;
    managerPending: number;
    adminPending: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
  recent: Array<
    Pick<AccessRequest, "id" | "requestNumber" | "accessName" | "requesterName" | "status" | "stage" | "createdAt">
  >;
}
