import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorBanner, PageLoader } from "../components/Feedback";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import type { AccessRequest, RequestStatus } from "../types";

type Filter = "ALL" | RequestStatus;

export function MyRequestsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AccessRequest | null>(null);
  const [editReason, setEditReason] = useState("");

  const query = useQuery({
    queryKey: ["my-requests"],
    queryFn: () => api<{ requests: AccessRequest[] }>("/requests/mine"),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const editMutation = useMutation({
    mutationFn: () => api(`/requests/${editing!.id}`, { method: "PATCH", body: JSON.stringify({ reason: editReason }) }),
    onSuccess: () => { setEditing(null); refresh(); },
  });
  const withdrawMutation = useMutation({
    mutationFn: (id: string) => api(`/requests/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const requests = query.data?.requests ?? [];
  const visible = useMemo(
    () => requests.filter((request) =>
      (filter === "ALL" || request.status === filter) &&
      `${request.requestNumber} ${request.accessName} ${request.reason}`.toLowerCase().includes(search.toLowerCase()),
    ),
    [filter, requests, search],
  );

  function openEdit(request: AccessRequest) {
    setEditing(request);
    setEditReason(request.reason);
    editMutation.reset();
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (editReason.trim().length >= 10) editMutation.mutate();
  }

  function withdraw(request: AccessRequest) {
    if (window.confirm(`Withdraw ${request.requestNumber}? The audit record will be retained.`)) {
      withdrawMutation.mutate(request.id);
    }
  }

  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <ErrorBanner message={query.error.message} />;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Request history"
        title="My requests"
        description="Track every request from submission through both approval stages."
        action={<Link className="button button--primary" to="/request-access"><Plus size={17} /> New request</Link>}
      />

      <section className="panel">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Filter by status">
            {(["ALL", "IN_PROGRESS", "APPROVED", "REJECTED", "CANCELLED"] as Filter[]).map((item) => (
              <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>
                {item === "ALL" ? "All" : item === "IN_PROGRESS" ? "In progress" : item === "CANCELLED" ? "Withdrawn" : item.charAt(0) + item.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests" /></label>
        </div>

        {withdrawMutation.isError && <ErrorBanner message={withdrawMutation.error.message} />}
        {visible.length === 0 ? (
          <EmptyState title="No requests found" text={requests.length ? "Try another filter or search term." : "Your first access request will appear here."} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Request ID</th><th>Access</th><th>Reason</th><th>Request date</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {visible.map((request) => {
                  const editable = request.status === "IN_PROGRESS" && request.stage === "MANAGER";
                  return (
                    <tr key={request.id}>
                      <td data-label="Request ID"><strong className="request-number">{request.requestNumber}</strong></td>
                      <td data-label="Access"><strong>{request.accessName}</strong></td>
                      <td data-label="Reason" className="reason-cell" title={request.reason}>{request.reason}</td>
                      <td data-label="Request date" className="muted">{formatDate(request.createdAt)}</td>
                      <td data-label="Status"><StatusBadge status={request.status} stage={request.stage} /></td>
                      <td className="table-actions">
                        {editable && <>
                          <button className="icon-button" title="Edit reason" onClick={() => openEdit(request)}><Pencil size={16} /></button>
                          <button className="icon-button icon-button--danger" title="Withdraw request" onClick={() => withdraw(request)} disabled={withdrawMutation.isPending}><Trash2 size={16} /></button>
                        </>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <button className="icon-button modal__close" onClick={() => setEditing(null)} aria-label="Close"><X size={19} /></button>
            <span className="eyebrow">{editing.requestNumber}</span>
            <h2 id="edit-title">Edit request reason</h2>
            <p>You can edit the reason while the request is still waiting for your manager.</p>
            <form onSubmit={submitEdit} className="form-stack">
              <label><span>Reason</span><textarea rows={6} maxLength={1000} value={editReason} onChange={(event) => setEditReason(event.target.value)} /></label>
              {editMutation.isError && <ErrorBanner message={editMutation.error.message} />}
              <div className="button-row button-row--end">
                <button type="button" className="button button--ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button className="button button--primary" disabled={editReason.trim().length < 10 || editMutation.isPending}>{editMutation.isPending ? "Saving..." : "Save changes"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

