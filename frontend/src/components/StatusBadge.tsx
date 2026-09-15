import type { ApprovalStage, RequestStatus } from "../types";
import { statusLabel } from "../lib/format";

export function StatusBadge({ status, stage }: { status: RequestStatus; stage: ApprovalStage }) {
  const tone =
    status === "APPROVED"
      ? "success"
      : status === "REJECTED"
        ? "danger"
        : status === "CANCELLED"
          ? "neutral"
          : stage === "ADMIN"
            ? "purple"
            : "warning";
  return <span className={`status status--${tone}`}>{statusLabel(status, stage)}</span>;
}

