import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock3, ListChecks, ShieldCheck, UserRoundCheck, XCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { ErrorBanner, PageLoader } from "../components/Feedback";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import type { DashboardData } from "../types";

export function DashboardPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashboardData>("/dashboard"),
    refetchInterval: 15_000,
  });

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !query.data) return <ErrorBanner message={query.error?.message ?? "Dashboard could not be loaded"} />;

  const { metrics, recent, scope } = query.data;
  const sharedScope = scope !== "PERSONAL";
  const overviewLabel = scope === "SYSTEM" ? "System overview" : scope === "TEAM" ? "Team overview" : "Your overview";
  const overviewDescription =
    scope === "SYSTEM"
      ? "Live request activity across the organization."
      : scope === "TEAM"
        ? "Live request activity for employees who report to you."
        : "A live view of your access requests and their progress.";
  const cards = [
    { label: "Total requests", value: metrics.totalRequests, icon: ListChecks, tone: "ink" },
    { label: "In progress", value: metrics.inProgress, icon: Clock3, tone: "amber" },
    { label: "Approved", value: metrics.approved, icon: CheckCircle2, tone: "green" },
    { label: "Rejected", value: metrics.rejected, icon: XCircle, tone: "red" },
  ];
  const pendingTotal = Math.max(metrics.inProgress, 1);

  return (
    <div className="page">
      <PageHeader
        eyebrow={overviewLabel}
        title={`Good day, ${user?.fullName.split(" ")[0]}`}
        description={overviewDescription}
        action={<Link className="button button--primary" to="/request-access">New request <ArrowRight size={17} /></Link>}
      />

      <section className="metric-grid" aria-label="Request summary">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article className="metric-card" key={label}>
            <span className={`metric-card__icon metric-card__icon--${tone}`}><Icon size={21} /></span>
            <div><span>{label}</span><strong>{value}</strong></div>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel__heading">
            <div><span className="eyebrow">Approval pipeline</span><h2>Requests in progress</h2></div>
            <span className="live-indicator"><i /> Live</span>
          </div>
          <div className="pipeline">
            <div className="pipeline__summary">
              <div><span className="pipeline__icon pipeline__icon--manager"><UserRoundCheck size={22} /></span><p><strong>{metrics.managerPending}</strong><small>Manager pending</small></p></div>
              <div><span className="pipeline__icon pipeline__icon--admin"><ShieldCheck size={22} /></span><p><strong>{metrics.adminPending}</strong><small>Admin pending</small></p></div>
            </div>
            <div className="progress-bar" aria-label="Distribution of pending approvals">
              <span className="progress-bar__manager" style={{ width: `${(metrics.managerPending / pendingTotal) * 100}%` }} />
              <span className="progress-bar__admin" style={{ width: `${(metrics.adminPending / pendingTotal) * 100}%` }} />
            </div>
            <p className="pipeline__note">A request remains in progress until both approval levels are complete.</p>
          </div>
        </section>

        <section className="panel panel--compact">
          <div className="panel__heading"><div><span className="eyebrow">Completion</span><h2>Decision rate</h2></div></div>
          <div className="decision-rate">
            <div className="donut" style={{ "--value": `${metrics.totalRequests ? Math.round(((metrics.approved + metrics.rejected) / metrics.totalRequests) * 100) : 0}%` } as CSSProperties}>
              <span>{metrics.totalRequests ? Math.round(((metrics.approved + metrics.rejected) / metrics.totalRequests) * 100) : 0}%</span>
            </div>
            <p><strong>{metrics.approved + metrics.rejected}</strong> finalized decisions<br /><small>{metrics.cancelled} withdrawn</small></p>
          </div>
        </section>
      </div>

      <section className="panel recent-panel">
        <div className="panel__heading">
          <div><span className="eyebrow">Latest activity</span><h2>Recent requests</h2></div>
          <Link className="text-link" to={scope === "PERSONAL" ? "/my-requests" : "/approvals"}>{scope === "PERSONAL" ? "View all" : "Review queue"} <ArrowRight size={15} /></Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Request</th><th>Access</th>{sharedScope && <th>Requester</th>}<th>Submitted</th><th>Status</th></tr></thead>
            <tbody>
              {recent.map((request) => (
                <tr key={request.id}>
                  <td data-label="Request"><strong className="request-number">{request.requestNumber}</strong></td>
                  <td data-label="Access">{request.accessName}</td>
                  {sharedScope && <td data-label="Requester">{request.requesterName}</td>}
                  <td data-label="Submitted" className="muted">{formatDate(request.createdAt)}</td>
                  <td data-label="Status"><StatusBadge status={request.status} stage={request.stage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
