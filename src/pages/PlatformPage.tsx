import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { repository } from "../data/repository";
import type { Tenant } from "../domain/types";
import { useAuth } from "../auth/AuthProvider";
import { LoginPanel } from "../components/LoginPanel";
import { PLAN_CATALOG, PLAN_ORDER, type PlanId } from "../commercial/planCatalog";

interface Assignment { planId: PlanId | "premium_demo"; status: "active" | "trial" | "past_due" | "suspended" | "cancelled" | "demo"; reason: string; }
const initial: Assignment = { planId:"essencial", status:"active", reason:"" };
const money = (cents: number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);

export function PlatformPage() {
  const { user, loading, logout } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<Assignment>(initial);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const list = await repository.listTenants();
    setTenants(list);
    setSelectedId((current) => current || list[0]?.id || "");
  }
  useEffect(() => {
    if (!user) { setAuthorized(null); setTenants([]); return; }
    repository.isPlatformOwner(user.uid).then(async (ok) => {
      setAuthorized(ok);
      if (ok) await reload();
    }).catch((err) => {setError(err instanceof Error ? err.message : "Falha no carregamento."); setAuthorized(false);});
  }, [user]);

  const selected = tenants.find((t) => t.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    const current = selected.commercial;
    setForm({
      planId:(current?.planId as Assignment["planId"]) || "essencial",
      status:current?.subscriptionStatus || "active",
      reason:"",
    });
  }, [selected]);

  async function assignPlan(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !selected || saving) return;
    setSaving(true);setError("");setMessage("");
    try {
      const api = import.meta.env.VITE_BOOKING_API_BASE_URL;
      if (!api) throw new Error("Worker não configurado: VITE_BOOKING_API_BASE_URL.");
      const token = await user.getIdToken();
      const response = await fetch(`${api.replace(/\/$/,"")}/api/admin/plans/assign`,{
        method:"POST",
        headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
        body:JSON.stringify({tenantId:selected.id,planId:form.planId,subscriptionStatus:form.status,reason:form.reason.trim()}),
      });
      const data = await response.json() as {error?:string};
      if (!response.ok) throw new Error(data.error || "Falha ao atribuir plano.");
      await reload();
      setMessage("Plano atribuído com registro de auditoria.");
    } catch(err) {setError(err instanceof Error ? err.message : "Falha de rede.");}
    finally {setSaving(false);}
  }

  if (loading) return <section className="page">Validando sessão…</section>;
  if (!user) return <LoginPanel title="Administração da plataforma" />;
  if (authorized === null) return <section className="page">Validando Platform Owner…</section>;
  if (!authorized) return <section className="page narrow"><div className="badge">ACESSO NEGADO</div><h1>Administração da plataforma</h1><p>O usuário autenticado não é Platform Owner.</p><button className="button" onClick={() => void logout()}>Sair</button></section>;
  return <section className="page">
    <div className="row between"><div><div className="badge">PLATFORM OWNER</div><h1>Tenants</h1></div><button className="button" onClick={() => void logout()}>Sair</button></div>
    <div className="grid cards">
      {tenants.map((tenant) => <article className="card" key={tenant.id}>
        <h3>{tenant.name}</h3>
        <p>slug: /{tenant.slug}</p><p>status: {tenant.status}</p>
        <p>Plano: {tenant.commercial?.planId || "LEGADO — ainda sem plano atribuído"}</p>
        <p>Assinatura: {tenant.commercial?.subscriptionStatus || "não atribuída"}</p>
        <Link to={`/app/${tenant.slug}`}>Abrir tenant</Link>
      </article>)}
    </div>
    <section aria-labelledby="plan-admin-heading">
      <h2 id="plan-admin-heading">Atribuição manual de plano</h2>
      <p>Somente Platform Owner. Alterações exigem justificativa e são auditadas atomicamente pelo Worker.</p>
      <form className="form narrow" onSubmit={(e) => void assignPlan(e)}>
        <label>Tenant
          <select value={selectedId} onChange={(e) => {setSelectedId(e.target.value);setMessage("");}} required>
            {tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label>Plano
          <select value={form.planId} onChange={(e) => setForm(f=>({...f,planId:e.target.value as Assignment["planId"]}))}>
            {PLAN_ORDER.map(id=><option key={id} value={id}>{PLAN_CATALOG[id].name} — {money(PLAN_CATALOG[id].monthlyPriceCents)}/mês</option>)}
            {selected?.kind === "demo" && <option value="premium_demo">Premium DEMO (fictício, sem cobrança)</option>}
          </select>
        </label>
        <label>Estado de assinatura
          <select value={form.status} onChange={(e)=>setForm(f=>({...f,status:e.target.value as Assignment["status"]}))}>
            {["active","trial","past_due","suspended","cancelled"].map(s=><option key={s} value={s}>{s}</option>)}
            {selected?.kind === "demo" && <option value="demo">demo</option>}
          </select>
        </label>
        <label>Justificativa (mínimo 10 caracteres)
          <input value={form.reason} minLength={10} maxLength={600} required onChange={(e)=>setForm(f=>({...f,reason:e.target.value}))} />
        </label>
        {form.status === "trial" && <p>Trial aprovado: 14 dias sem cartão, contados na atribuição pelo servidor.</p>}
        <button className="button primary" disabled={saving || !selected} type="submit">{saving?"Salvando…":"Aplicar e auditar"}</button>
        {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
      </form>
    </section>
  </section>;
}
