import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, ShieldCheck, UserRoundCheck, X, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { EmptyState, ErrorBanner, PageLoader } from "../components/Feedback";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import type { AccessRequest } from "../types";

interface DecisionTarget {
  request: AccessRequest;
  decision: "APPROVE" | "REJECT";
}

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<DecisionTarget | null>(null);
  const [comment, setComment] = useState("");

  const query = useQuery({
    queryKey: ["approvals"],
    queryFn: () => api<{ requests: AccessRequest[] }>("/requests/approvals"),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api(`/requests/${target!.request.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: target!.decision, comment }),
      }),
    onSuccess: () => {
      setTarget(null);
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function openDecision(request: AccessRequest, decision: DecisionTarget["decision"]) {
    setTarget({ request, decision });
    setComment("");
    mutation.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <ErrorBanner message={query.error.message} />;

  const requests = query.data?.requests ?? [];
  const managerRequests = requests.filter((request) => request.stage === "MANAGER");
  const adminRequests = requests.filter((request) => request.stage === "ADMIN");

  return (
    <div className="page">
      <PageHeader
        eyebrow="Decision queue"
        title="Approve requests"
        description="Only requests assigned to you at their current approval stage appear here."
      />

      <div className="queue-summary">
        <div><span className="pipeline__icon pipeline__icon--manager"><UserRoundCheck size={20} /></span><p><strong>{managerRequests.length}</strong><small>Manager reviews</small></p></div>
        <i />
        <div><span className="pipeline__icon pipeline__icon--admin"><ShieldCheck size={20} /></span><p><strong>{adminRequests.length}</strong><small>Admin reviews</small></p></div>
      </div>

      {requests.length === 0 ? (
        <section className="panel"><EmptyState title="You’re all caught up" text="There are no requests assigned to you at this approval stage." /></section>
      ) : (
        <div className="approval-sections">
          {managerRequests.length > 0 && (
            <ApprovalSection title="Manager approval" description="Requests submitted by people who report to you." requests={managerRequests} onDecision={openDecision} />
          )}
          {adminRequests.length > 0 && (
            <ApprovalSection title="Admin approval" description="Requests that have already passed manager review." requests={adminRequests} onDecision={openDecision} />
          )}
        </div>
      )}

      <p className="security-note"><ShieldCheck size={16} /> Decisions are checked again by the API. A hidden or stale request cannot bypass its assigned reviewer or stage.</p>

      {target && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTarget(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="decision-title">
            <button className="icon-button modal__close" onClick={() => setTarget(null)} aria-label="Close"><X size={19} /></button>
            <span className={`decision-icon decision-icon--${target.decision.toLowerCase()}`}>
              {target.decision === "APPROVE" ? <Check size={25} /> : <XCircle size={25} />}
            </span>
            <h2 id="decision-title">{target.decision === "APPROVE" ? "Approve" : "Reject"} {target.request.requestNumber}?</h2>
            <p>
              {target.decision === "APPROVE" && target.request.stage === "MANAGER"
                ? "This will move the request to administrator approval. It will remain in progress."
                : target.decision === "APPROVE"
                  ? "This is the final approval and will mark the request approved."
                  : "A rejection is final and will close the request."}
            </p>
            <div className="decision-request"><strong>{target.request.accessName}</strong><span>{target.request.requesterName}</span><small>{target.request.reason}</small></div>
            <form onSubmit={submit} className="form-stack">
              <label><span>Decision note <small>(optional)</small></span><textarea rows={4} maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add context for the requester and audit trail..." /></label>
              {mutation.isError && <ErrorBanner message={mutation.error.message} />}
              <div className="button-row button-row--end">
                <button type="button" className="button button--ghost" onClick={() => setTarget(null)}>Cancel</button>
                <button className={`button ${target.decision === "APPROVE" ? "button--primary" : "button--danger"}`} disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving decision..." : `Confirm ${target.decision.toLowerCase()}`}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function ApprovalSection({
  title,
  description,
  requests,
  onDecision,
}: {
  title: string;
  description: string;
  requests: AccessRequest[];
  onDecision: (request: AccessRequest, decision: "APPROVE" | "REJECT") => void;
}) {
  return (
    <section>
      <div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div><span>{requests.length}</span></div>
      <div className="approval-list">
        {requests.map((request) => (
          <article className="approval-card" key={request.id}>
            <div className="approval-card__top">
              <div className="avatar avatar--large">{request.requesterName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
              <div><strong>{request.requesterName}</strong><span>{request.requesterEmail}</span></div>
              <span className="request-number">{request.requestNumber}</span>
            </div>
            <div className="approval-card__body">
              <span className="eyebrow">Requested access</span>
              <h3>{request.accessName}</h3>
              <blockquote>{request.reason}</blockquote>
              <span className="request-time"><Clock3 size={15} /> Submitted {formatDate(request.createdAt)}</span>
            </div>
            <div className="approval-card__footer">
              <button className="button button--reject" onClick={() => onDecision(request, "REJECT")}><X size={17} /> Reject</button>
              <button className="button button--approve" onClick={() => onDecision(request, "APPROVE")}><Check size={17} /> Approve</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
