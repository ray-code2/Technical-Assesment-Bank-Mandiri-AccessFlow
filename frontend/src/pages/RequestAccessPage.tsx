import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AccessIcon } from "../components/AccessIcon";
import { EmptyState, ErrorBanner, PageLoader } from "../components/Feedback";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { AccessRequest, AccessType } from "../types";

export function RequestAccessPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [created, setCreated] = useState<AccessRequest | null>(null);

  const accessQuery = useQuery({
    queryKey: ["access-types"],
    queryFn: () => api<{ accessTypes: AccessType[] }>("/access-types"),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      api<{ request: AccessRequest }>("/requests", {
        method: "POST",
        body: JSON.stringify({ accessTypeId: selectedId, reason }),
      }),
    onSuccess: ({ request }) => {
      setCreated(request);
      setSelectedId("");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (selectedId && reason.trim().length >= 10) createMutation.mutate();
  }

  if (accessQuery.isLoading) return <PageLoader />;
  if (accessQuery.isError) return <ErrorBanner message={accessQuery.error.message} />;

  const accessTypes = accessQuery.data?.accessTypes ?? [];
  const selected = accessTypes.find((item) => item.id === selectedId);

  if (created) {
    return (
      <div className="page page--narrow">
        <section className="success-card">
          <span className="success-card__icon"><CheckCircle2 size={32} /></span>
          <span className="eyebrow">Request submitted</span>
          <h1>It’s with your manager</h1>
          <p>Your request <strong>{created.requestNumber}</strong> for <strong>{created.accessName}</strong> has entered the first approval stage.</p>
          <div className="workflow-line">
            <span className="workflow-line__step workflow-line__step--active"><i>1</i><small>Manager</small></span>
            <b />
            <span className="workflow-line__step"><i>2</i><small>Admin</small></span>
            <b />
            <span className="workflow-line__step"><i>3</i><small>Complete</small></span>
          </div>
          <div className="button-row">
            <button className="button button--secondary" onClick={() => setCreated(null)}>Create another</button>
            <Link className="button button--primary" to="/my-requests">View my requests <ArrowRight size={17} /></Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader eyebrow="New request" title="Request access" description="Choose the resource you need and give your manager enough context to decide." />
      <form className="request-form" onSubmit={submit}>
        <section className="panel">
          <div className="step-heading"><span>1</span><div><h2>Select an access</h2><p>Available resources maintained by your administrator.</p></div></div>
          {accessTypes.length === 0 ? (
            <EmptyState title="No access is available" text="Ask an administrator to activate an access type." />
          ) : (
            <div className="access-grid">
              {accessTypes.map((access) => (
                <label className={`access-option ${selectedId === access.id ? "access-option--selected" : ""}`} key={access.id}>
                  <input type="radio" name="access" value={access.id} checked={selectedId === access.id} onChange={() => setSelectedId(access.id)} />
                  <span className="access-option__icon"><AccessIcon icon={access.icon} /></span>
                  <span><strong>{access.name}</strong><small>{access.description}</small></span>
                  <i className="radio-mark" />
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="step-heading"><span>2</span><div><h2>Explain the business need</h2><p>A specific reason helps reviewers decide quickly.</p></div></div>
          <label className="field">
            <span>Reason for access</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={6} placeholder="Example: I need VPN access to support the production release while working remotely..." required />
            <small className={reason.length > 0 && reason.trim().length < 10 ? "field-hint field-hint--error" : "field-hint"}>
              <span>{reason.length > 0 && reason.trim().length < 10 ? "Use at least 10 characters" : "Do not include passwords or confidential credentials."}</span>
              <span>{reason.length}/1000</span>
            </small>
          </label>
        </section>

        {createMutation.isError && <ErrorBanner message={createMutation.error.message} />}
        <div className="form-actions">
          <Link className="button button--ghost" to="/my-requests"><ChevronLeft size={17} /> Cancel</Link>
          <div className="submission-summary">
            <span>{selected ? selected.name : "No access selected"}</span>
            <small>First reviewer: your manager</small>
          </div>
          <button className="button button--primary" disabled={!selectedId || reason.trim().length < 10 || createMutation.isPending}>
            {createMutation.isPending ? "Submitting..." : "Submit request"} <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </div>
  );
}

