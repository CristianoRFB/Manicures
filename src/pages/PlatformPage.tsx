import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { repository } from "../data/repository";
import type { Tenant } from "../domain/types";
import { useAuth } from "../auth/AuthProvider";
import { LoginPanel } from "../components/LoginPanel";
import { IMPLEMENTED_FEATURES, PLAN_CATALOG, PLAN_ORDER, type FeatureKey, type PlanId } from "../commercial/planCatalog";

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
  const [overrideFeature, setOverrideFeature] = useState<FeatureKey>("booking.create");
  const [overrideMode, setOverrideMode] = useState<"inherit"|"allow"|"deny">("inherit");
  const [professionalCap, setProfessionalCap] = useState("");
  const [adminCap, setAdminCap] = useState("");
  const [adminUid, setAdminUid] = useState("");
  const [adminStatus, setAdminStatus] = useState<"active" | "disabled">("active");
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminResult, setAdminResult] = useState("");
  const [adminError, setAdminError] = useState("");
  const [reconcileReason,setReconcileReason]=useState("");
  const [reconcileWorking,setReconcileWorking]=useState(false);
  const [reconcileMessage,setReconcileMessage]=useState("");

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
    setProfessionalCap(current?.limitOverrides?.professionals_active?.toString() ?? "");
    setAdminCap(current?.limitOverrides?.tenant_admins?.toString() ?? "");

  }, [selected]);

  useEffect(() => {
    const current = selected?.commercial?.entitlementOverrides?.[overrideFeature];
    setOverrideMode(current===true?"allow":current===false?"deny":"inherit");
  },[selected,overrideFeature]);

  async function assignPlan(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !selected || saving) return;
    setSaving(true);setError("");setMessage("");
    try {
      const api = import.meta.env.VITE_BOOKING_API_BASE_URL;
      if (!api) throw new Error("Worker não configurado: VITE_BOOKING_API_BASE_URL.");
      const token = await user.getIdToken();
      const entitlements = {...(selected.commercial?.entitlementOverrides ?? {})};
      delete entitlements[overrideFeature];
      if(overrideMode!=="inherit") entitlements[overrideFeature] = overrideMode==="allow";
      const limits = {...(selected.commercial?.limitOverrides ?? {})};
      const parseOverride=(value:string,key:"professionals_active"|"tenant_admins")=>{
        if(!value.trim()) {delete limits[key]; return;}
        if(!/^\\d{1,4}$/.test(value.trim())) throw new Error("Limite inválido: use inteiro de 0 a 9999.");
        limits[key] = Number(value.trim());
      };
      parseOverride(professionalCap,"professionals_active");
      parseOverride(adminCap,"tenant_admins");
      const response = await fetch(`${api.replace(/\/$/,"")}/api/admin/plans/assign`,{
        method:"POST",
        headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
        body:JSON.stringify({
          tenantId:selected.id,planId:form.planId,subscriptionStatus:form.status,
          reason:form.reason.trim(),entitlementOverrides:entitlements,limitOverrides:limits,
        }),
      });
      const data = await response.json() as {error?:string};
      if (!response.ok) throw new Error(data.error || "Falha ao atribuir plano.");
      await reload();
      setMessage("Plano atribuído com registro de auditoria.");
    } catch(err) {setError(err instanceof Error ? err.message : "Falha de rede.");}
    finally {setSaving(false);}
  }

  async function saveAdmin(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !selected || adminSaving) return;
    setAdminSaving(true);
    setAdminResult("");
    setAdminError("");
    try {
      const api=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!api) throw new Error("Worker não configurado.");
      const response=await fetch(`${api.replace(/\/$/,"")}/api/admin/memberships/tenant-admin`, {
        method:"POST",
        headers:{"content-type":"application/json",authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:selected.id,userId:adminUid.trim(),status:adminStatus}),
      });
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??"Falha ao atualizar o administrador.");
      setAdminResult("Associação de administrador atualizada com auditoria.");
      setAdminUid("");
    } catch(error) {
      setAdminError(error instanceof Error ? error.message : "Falha de comunicação.");
    } finally {
      setAdminSaving(false);
    }
  }

  async function reconcileUsage(event:React.FormEvent){
    event.preventDefault();
    if(!user||!selected||reconcileWorking)return;
    setReconcileWorking(true);setReconcileMessage("");
    try{
      const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!base)throw new Error("Worker não configurado.");
      const response=await fetch(`${base.replace(/\/$/,"")}/api/platform/usage/reconcile`,{
        method:"POST",headers:{"content-type":"application/json",
          authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:selected.id,reason:reconcileReason.trim()}),
      });
      const result=await response.json() as {
        error?:string;before?:{professionalsActive:number|null;tenantAdminsAdditional:number|null};
        after?:{professionalsActive:number;tenantAdminsAdditional:number};
      };
      if(!response.ok)throw new Error(result.error??"Falha na conferência.");
      setReconcileMessage(`Contadores conferidos: profissionais ${result.before?.professionalsActive??"legado"} → ${result.after?.professionalsActive};
        admins ${result.before?.tenantAdminsAdditional??"legado"} → ${result.after?.tenantAdminsAdditional}.
        Dados da equipe preservados; evento auditado.`);
      setReconcileReason("");
    }catch(err){setReconcileMessage(err instanceof Error?err.message:"Falha de rede.");}
    finally{setReconcileWorking(false);}
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
    <section aria-labelledby="reconcile-heading">
      <h2 id="reconcile-heading">Reconciliar contadores de equipe</h2>
      <p>Somente Platform Owner. Reconta profissionais e administradores com base nos documentos atuais, mantendo todos os dados e os planos. Use apenas em divergências confirmadas.</p>
      <form className="form narrow" onSubmit={event=>void reconcileUsage(event)}>
        <p>Tenant selecionado: <strong>{selected?.name??"Nenhum"}</strong></p>
        <label>Justificativa (mínimo 10 caracteres)
          <input required minLength={10} maxLength={300} value={reconcileReason}
            onChange={event=>setReconcileReason(event.target.value)}/>
        </label>
        <button className="button" type="submit" disabled={!selected||reconcileWorking}>
          {reconcileWorking?"Conferindo…":"Reconciliar com auditoria"}
        </button>
        {reconcileMessage&&<p role="status">{reconcileMessage}</p>}
      </form>
    </section>
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
        {form.status==="trial"&&<p role="status">Trial aprovado: 14 dias corridos a partir da atribuição. O Worker calcula e audita o término; não existe checkout ou cobrança automática.</p>}
        <label>Justificativa (mínimo 10 caracteres)
          <input value={form.reason} minLength={10} maxLength={600} required onChange={(e)=>setForm(f=>({...f,reason:e.target.value}))} />
        </label>
        <fieldset>
          <legend>Overrides manuais (apenas funções implementadas)</legend>
          <label>Funcionalidade
            <select value={overrideFeature} onChange={(e)=>setOverrideFeature(e.target.value as FeatureKey)}>
              {[...IMPLEMENTED_FEATURES].sort().map(key=><option key={key} value={key}>{key}</option>)}
            </select>
          </label>
          <label>Permissão excepcional
            <select value={overrideMode} onChange={(e)=>setOverrideMode(e.target.value as "inherit"|"allow"|"deny")}>
              <option value="inherit">Usar definição do plano</option>
              <option value="allow">Liberar explicitamente</option>
              <option value="deny">Bloquear explicitamente</option>
            </select>
          </label>
          <p>Fundamentos de segurança e integridade nunca são diferenciados por plano.</p>
          <label>Limite excepcional de profissionais (vazio = plano)
            <input inputMode="numeric" pattern="\\d{1,4}" value={professionalCap}
              placeholder="Herdar" onChange={(e)=>setProfessionalCap(e.target.value)} />
          </label>
          <label>Limite excepcional de administradores (vazio = plano)
            <input inputMode="numeric" pattern="\\d{1,4}" value={adminCap}
              placeholder="Herdar" onChange={(e)=>setAdminCap(e.target.value)} />
          </label>
        </fieldset>
        {form.status === "trial" && <p>Trial aprovado: 14 dias sem cartão, contados na atribuição pelo servidor.</p>}
        <button className="button primary" disabled={saving || !selected} type="submit">{saving?"Salvando…":"Aplicar e auditar"}</button>
        {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
      </form>
    </section>
    <section aria-labelledby="staff-admin-heading">
      <h2 id="staff-admin-heading">Administradores adicionais</h2>
      <p>Somente Platform Owner pode criar associações novas. O Worker aplica o limite 0 / 2 / 5 por plano e registra auditoria; desativar preserva o histórico.</p>
      <form className="form narrow" onSubmit={(event)=>void saveAdmin(event)}>
        <label>Identificador do tenant
          <input value={selected?.name ?? ""} readOnly />
        </label>
        <label>UID de uma conta Firebase existente
          <input value={adminUid} pattern="[a-zA-Z0-9_-]{1,128}" required
            autoComplete="off" onChange={(event)=>setAdminUid(event.target.value)} />
        </label>
        <label>Operação
          <select value={adminStatus} onChange={(event)=>setAdminStatus(event.target.value as "active"|"disabled")}>
            <option value="active">Ativar administrador</option>
            <option value="disabled">Desativar administrador</option>
          </select>
        </label>
        <button className="button primary" disabled={!selected || adminSaving} type="submit">{adminSaving?"Salvando…":"Atualizar administrador"}</button>
        {adminResult && <p role="status">{adminResult}</p>}
        {adminError && <p role="alert">{adminError}</p>}
      </form>
    </section>
  </section>;
}
