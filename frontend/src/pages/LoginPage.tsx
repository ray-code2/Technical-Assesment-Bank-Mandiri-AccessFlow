import { ArrowRight, CheckCircle2, KeyRound, Layers3, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const demoAccounts = [
  { label: "Employee", email: "alice.user@accessflow.dev", note: "Create and track requests" },
  { label: "Manager", email: "bob.manager@accessflow.dev", note: "Review team requests" },
  { label: "Admin", email: "carol.admin@accessflow.dev", note: "Give final approval" },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("alice.user@accessflow.dev");
  const [password, setPassword] = useState("Password123!");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand brand--light">
          <span className="brand__mark"><ShieldCheck size={23} /></span>
          <span>AccessFlow</span>
        </div>
        <div className="login-story__content">
          <span className="eyebrow eyebrow--light">Access governance, simplified</span>
          <h1>The right access.<br />The right approvals.</h1>
          <p>A clear, auditable path from employee request to manager review and final administrator approval.</p>
          <div className="workflow-preview">
            <div><span><KeyRound size={18} /></span><p><strong>Request</strong><small>Employee explains the need</small></p></div>
            <i />
            <div><span><Layers3 size={18} /></span><p><strong>Review</strong><small>Manager validates context</small></p></div>
            <i />
            <div><span><CheckCircle2 size={18} /></span><p><strong>Approve</strong><small>Admin makes final decision</small></p></div>
          </div>
        </div>
        <p className="login-story__footer">Secure by design · Complete decision history · Role-aware queues</p>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-heading">
            <span className="login-heading__icon"><KeyRound size={21} /></span>
            <h2>Welcome back</h2>
            <p>Sign in with your company account to continue.</p>
          </div>
          {error && <div className="alert alert--error" role="alert">{error}</div>}
          <form onSubmit={handleSubmit} className="form-stack">
            <label>
              <span>Work email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
            <button className="button button--primary button--full" type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
              {!submitting && <ArrowRight size={18} />}
            </button>
          </form>
          <div className="demo-accounts">
            <div className="demo-accounts__heading"><span>Demo accounts</span><small>Password: Password123!</small></div>
            {demoAccounts.map((account) => (
              <button key={account.email} type="button" onClick={() => { setEmail(account.email); setPassword("Password123!"); }}>
                <span className="demo-role">{account.label[0]}</span>
                <span><strong>{account.label}</strong><small>{account.note}</small></span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

