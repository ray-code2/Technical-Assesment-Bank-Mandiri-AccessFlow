import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Power, RotateCcw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AccessIcon } from "../components/AccessIcon";
import { ErrorBanner, PageLoader } from "../components/Feedback";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import type { AccessType } from "../types";

const defaultForm = { name: "", description: "", icon: "key" as AccessType["icon"] };

export function AccessCatalogPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [showForm, setShowForm] = useState(false);

  const query = useQuery({
    queryKey: ["access-types", "admin"],
    queryFn: () => api<{ accessTypes: AccessType[] }>("/access-types/admin"),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["access-types"] });
  };
  const createMutation = useMutation({
    mutationFn: () => api("/access-types", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { setForm(defaultForm); setShowForm(false); refresh(); },
  });
  const toggleMutation = useMutation({
    mutationFn: (item: AccessType) => item.isActive
      ? api(`/access-types/${item.id}`, { method: "DELETE" })
      : api(`/access-types/${item.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) }),
    onSuccess: refresh,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <ErrorBanner message={query.error.message} />;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Administration"
        title="Access catalog"
        description="Manage the resources employees can request. Disabled items remain attached to historical requests."
        action={<button className="button button--primary" onClick={() => setShowForm((value) => !value)}><Plus size={17} /> Add access</button>}
      />

      {showForm && (
        <section className="panel catalog-form">
          <div className="panel__heading"><div><span className="eyebrow">New catalog item</span><h2>Add requestable access</h2></div></div>
          <form onSubmit={submit} className="catalog-form__grid">
            <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Database read access" required minLength={2} /></label>
            <label><span>Icon</span><select value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value as AccessType["icon"] })}>{["key", "shield", "code", "palette", "ticket", "database"].map((icon) => <option value={icon} key={icon}>{icon}</option>)}</select></label>
            <label className="catalog-form__description"><span>Description</span><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What this access provides" required minLength={5} /></label>
            {createMutation.isError && <ErrorBanner message={createMutation.error.message} />}
            <div className="button-row button-row--end"><button type="button" className="button button--ghost" onClick={() => setShowForm(false)}>Cancel</button><button className="button button--primary" disabled={createMutation.isPending}>{createMutation.isPending ? "Adding..." : "Add to catalog"}</button></div>
          </form>
        </section>
      )}

      {toggleMutation.isError && <ErrorBanner message={toggleMutation.error.message} />}
      <section className="catalog-grid">
        {query.data?.accessTypes.map((item) => (
          <article className={`catalog-card ${!item.isActive ? "catalog-card--disabled" : ""}`} key={item.id}>
            <span className="access-option__icon"><AccessIcon icon={item.icon} /></span>
            <div><span className={`status ${item.isActive ? "status--success" : "status--neutral"}`}>{item.isActive ? "Active" : "Disabled"}</span><h2>{item.name}</h2><p>{item.description}</p></div>
            <button className="button button--secondary" onClick={() => toggleMutation.mutate(item)} disabled={toggleMutation.isPending}>
              {item.isActive ? <><Power size={16} /> Disable</> : <><RotateCcw size={16} /> Restore</>}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

