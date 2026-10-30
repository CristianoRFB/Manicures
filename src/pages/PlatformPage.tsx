import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { repository } from "../data/repository";
import type { Tenant } from "../domain/types";
import { useAuth } from "../auth/AuthProvider";
import { LoginPanel } from "../components/LoginPanel";
import { IMPLEMENTED_FEATURES, PLAN_CATALOG, PLAN_ORDER, type FeatureKey, type PlanId } from "../commercial/planCatalog";

type RemovalRequest={requestId:string;objectPath:string;status:string;reason:string;createdAt:string;reviewedAt?:string;reviewReason?:string;storageGeneration?:string;deletedAt?:string};
type MediaObject={path:string;generation:string;size:number;mediaClass:string;contentType:string};
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
  const [uploadPauseReason,setUploadPauseReason]=useState("");
  const [uploadPauseWorking,setUploadPauseWorking]=useState(false);
  const [uploadPauseMessage,setUploadPauseMessage]=useState("");
  const [removalRows,setRemovalRows]=useState<RemovalRequest[]>([]);
  const [removalBusy,setRemovalBusy]=useState(false);
  const [removalReason,setRemovalReason]=useState("");
  const [removalMessage,setRemovalMessage]=useState("");
  const [mediaObjects,setMediaObjects]=useState<MediaObject[]>([]);
  const [inventoryToken,setInventoryToken]=useState<string|null>(null);
  const [inventoryBusy,setInventoryBusy]=useState(false);
  const [inventoryMessage,setInventoryMessage]=useState("");
  const [capacityThresholdMiB,setCapacityThresholdMiB]=useState("");
  const [capacityBusy,setCapacityBusy]=useState(false);
  const [capacityReport,setCapacityReport]=useState("");
  const [capacityContinuation,setCapacityContinuation]=useState<string|null>(null);
  const [deletionConfirmation,setDeletionConfirmation]=useState("");
  const [deletionReason,setDeletionReason]=useState("");

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
  const mediaBytesLoaded=mediaObjects.reduce((sum,item)=>sum+item.size,0);
  const mediaLegacyLoaded=mediaObjects.filter(item=>item.mediaClass==="UNKNOWN_LEGACY").length;
  useEffect(()=>{
    setMediaObjects([]);setInventoryToken(null);setRemovalRows([]);
    setDeletionConfirmation("");setDeletionReason("");
    setCapacityReport("");setCapacityContinuation(null);
  },[selectedId]);

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

  async function mediaRequest(action:"list"|"review",data:Record<string,unknown>){
    if(!user||!selected)throw new Error("Selecione um studio.");
    const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
    if(!base)throw new Error("Worker não configurado.");
    const route=action==="list"?"/api/media/removal/list":"/api/platform/media/removal/review";
    const response=await fetch(`${base.replace(/\/$/,"")}${route}`,{
      method:"POST",headers:{"content-type":"application/json",
        authorization:`Bearer ${await user.getIdToken()}`},
      body:JSON.stringify({tenantId:selected.id,...data}),
    });
    const result=await response.json() as {error?:string;requests?:RemovalRequest[]};
    if(!response.ok)throw new Error(result.error??"Falha ao consultar remoções.");
    return result;
  }
  async function refreshRemovalRequests(){
    setRemovalBusy(true);setRemovalMessage("");
    try{setRemovalRows((await mediaRequest("list",{})).requests??[]);}
    catch(err){setRemovalMessage(err instanceof Error?err.message:"Falha na consulta.");}
    finally{setRemovalBusy(false);}
  }
  async function reviewRemoval(requestId:string,decision:"approve"|"reject"){
    if(removalBusy)return;
    setRemovalBusy(true);setRemovalMessage("");
    try{
      await mediaRequest("review",{requestId,decision,reviewReason:removalReason.trim()});
      const result=await mediaRequest("list",{});
      setRemovalRows(result.requests??[]);setRemovalReason("");
      setRemovalMessage("Revisão auditada. Aprovação NÃO executa exclusão física; operação manual continua pendente.");
    }catch(err){setRemovalMessage(err instanceof Error?err.message:"Falha na revisão.");}
    finally{setRemovalBusy(false);}
  }

  async function loadMediaInventory(continuation=false){
    if(!selected||!user||inventoryBusy)return;
    setInventoryBusy(true);setInventoryMessage("");
    try{
      const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!base)throw new Error("Worker não configurado.");
      const response=await fetch(`${base.replace(/\/$/,"")}/api/platform/media/inventory`,{
        method:"POST",headers:{"content-type":"application/json",
          authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:selected.id,...(continuation&&inventoryToken?{pageToken:inventoryToken}:{})}),
      });
      const data=await response.json() as {error?:string;objects?:MediaObject[];
        nextPageToken?:string|null;pageBytes?:number;exhaustive?:boolean};
      if(!response.ok)throw new Error(data.error??"Inventário indisponível.");
      setMediaObjects(current=>continuation?[...current,...(data.objects??[])]:data.objects??[]);
      setInventoryToken(data.nextPageToken??null);
      setInventoryMessage(`Página consultada: ${data.objects?.length??0} objetos, ${data.pageBytes??0} bytes.
        ${data.exhaustive?"Fim do inventário.":"Há mais páginas."} Não representa egress nem fatura.`);
    }catch(err){setInventoryMessage(err instanceof Error?err.message:"Erro no inventário.");}
    finally{setInventoryBusy(false);}
  }
  async function scanMediaCapacity(continuation=false){
    if(!selected||!user||capacityBusy)return;
    setCapacityBusy(true);setCapacityReport("");
    try{
      const threshold=capacityThresholdMiB.trim();
      const alertThresholdBytes=threshold?Math.round(Number(threshold)*1024*1024):undefined;
      if(alertThresholdBytes!==undefined&&(!Number.isSafeInteger(alertThresholdBytes)||alertThresholdBytes<1))
        throw new Error("Informe limiar em MiB positivo e seguro.");
      const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!base)throw new Error("Worker não configurado.");
      const response=await fetch(`${base.replace(/\/$/,"")}/api/platform/media/inventory/scan`,{
        method:"POST",headers:{"content-type":"application/json",
          authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:selected.id,maxPages:10,
          ...(continuation&&capacityContinuation?{pageToken:capacityContinuation}:{}),
          ...(alertThresholdBytes?{alertThresholdBytes}:{})}),
      });
      const data=await response.json() as {error?:string;metrics?:{objectCount:number;totalBytes:number;
        persistentCount:number;legacyCount:number};complete?:boolean;nextPageToken?:string|null;
        observedThresholdExceeded?:boolean;pagesScanned?:number};
      if(!response.ok||!data.metrics)throw new Error(data.error??"Falha na varredura.");
      setCapacityContinuation(data.nextPageToken??null);
      setCapacityReport(`Somente este lote: ${data.metrics.objectCount} objetos e
        ${(data.metrics.totalBytes/1024/1024).toFixed(2)} MiB em
        ${data.pagesScanned??0} página(s). Legados: ${data.metrics.legacyCount}.
        ${data.observedThresholdExceeded?"LIMIAR OPERACIONAL EXCEDIDO nos bytes observados.":""}
        ${data.complete?"Consulta concluída.":"Há mais páginas: total parcial."}
        Sem estimativa de egress ou fatura.`);
    }catch(err){setCapacityReport(err instanceof Error?err.message:"Falha na varredura.");}
    finally{setCapacityBusy(false);}
  }
  async function executeMediaRemoval(row:RemovalRequest){
    if(!selected||!user||removalBusy||deletionConfirmation!=="REMOVER_MIDIA_APROVADA"||
      deletionReason.trim().length<10)return;
    const item=mediaObjects.find(obj=>obj.path===row.objectPath);
    const generation=item?.generation||(row.status==="deletion_in_progress"?row.storageGeneration:undefined);
    if(!generation){setRemovalMessage("Inspecione a geração no inventário, ou recupere a geração já registrada no ledger.");return;}
    setRemovalBusy(true);setRemovalMessage("");
    try{
      const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!base)throw new Error("Worker não configurado.");
      const response=await fetch(`${base.replace(/\/$/,"")}/api/platform/media/removal/execute`,{
        method:"POST",headers:{"content-type":"application/json",
          authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:selected.id,requestId:row.requestId,
          expectedGeneration:generation,confirmation:deletionConfirmation,
          reason:deletionReason.trim()}),
      });
      const result=await response.json() as {error?:string;storageDeleted?:boolean;status?:string};
      if(!response.ok)throw new Error(result.error??"Falha na execução.");
      if(result.storageDeleted!==true||result.status!=="deleted_verified")
        throw new Error("A remoção não foi verificada no provedor.");
      setRemovalMessage("Ausência do objeto confirmada no Storage e operação auditada. Caches externos ainda podem reter cópias.");
      setMediaObjects(items=>items.filter(obj=>obj.path!==row.objectPath));
      setDeletionConfirmation("");setDeletionReason("");
      setRemovalRows((await mediaRequest("list",{})).requests??[]);
    }catch(err){setRemovalMessage(err instanceof Error?err.message:"Falha na exclusão. Verifique estado antes de repetir.");}
    finally{setRemovalBusy(false);}
  }

  async function changeUploadPause(paused:boolean){
    if(!user||!selected||uploadPauseWorking)return;
    setUploadPauseWorking(true);setUploadPauseMessage("");
    try{
      const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!base)throw new Error("Worker não configurado.");
      const response=await fetch(`${base.replace(/\/$/,"")}/api/platform/media/pause`,{
        method:"POST",headers:{"content-type":"application/json",
          authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:selected.id,paused,reason:uploadPauseReason.trim()}),
      });
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??"Falha ao alterar uploads.");
      await reload();
      setUploadPauseReason("");
      setUploadPauseMessage(paused?"Novos uploads bloqueados. Arquivos existentes preservados.":"Uploads reabilitados para este tenant.");
    }catch(err){setUploadPauseMessage(err instanceof Error?err.message:"Falha ao alterar uploads.");}
    finally{setUploadPauseWorking(false);}
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
    <section aria-labelledby="media-inventory-heading">
      <h2 id="media-inventory-heading">Inventário do portfólio</h2>
      <p>Consulta limitada a 100 objetos por página. Os tamanhos servem para estimar armazenamento listado; não medem tráfego, cobranças ou capacidade total.</p>
      <button type="button" className="button" disabled={!selected||inventoryBusy}
        onClick={()=>void loadMediaInventory()}>{inventoryBusy?"Consultando…":"Inspecionar objetos"}</button>
      {inventoryToken&&<button type="button" className="button" disabled={inventoryBusy}
        onClick={()=>void loadMediaInventory(true)}>Próxima página</button>}
      {inventoryMessage&&<p role="status">{inventoryMessage}</p>}
      {mediaObjects.length>0&&<p role="status">
        Páginas já carregadas: <strong>{mediaObjects.length} arquivos</strong>,
        <strong> {(mediaBytesLoaded/1024/1024).toFixed(2)} MiB</strong> de metadados de armazenamento;
        <strong> {mediaLegacyLoaded} sem classificação moderna</strong>.
        {inventoryToken?" Há mais páginas: estes números são parciais.":" Listagem de páginas concluída nesta consulta."}
        Isso não representa egress nem cobrança.
      </p>}
      <div className="form narrow">
        <h3>Varredura operacional de capacidade</h3>
        <p>Máximo de 10 páginas por solicitação. Limiar opcional em MiB é alerta de operação,
          não quota comercial nem previsão de custo.</p>
        <label>Limiar operacional de alerta (MiB; opcional)
          <input type="number" min="0.01" step="any" value={capacityThresholdMiB}
            onChange={event=>setCapacityThresholdMiB(event.target.value)} /></label>
        <div className="row">
          <button className="button" type="button" disabled={!selected||capacityBusy}
            onClick={()=>void scanMediaCapacity(false)}>Verificar capacidade observada</button>
          {capacityContinuation&&<button className="button" type="button" disabled={capacityBusy}
            onClick={()=>void scanMediaCapacity(true)}>Continuar varredura</button>}
        </div>
        {capacityReport&&<p role="status">{capacityReport}</p>}
      </div>
      {mediaObjects.map(item=><p key={item.path}>
        <code>{item.path.split("/").pop()}</code> · geração <code>{item.generation}</code> ·
        {item.size} bytes · {item.mediaClass}
      </p>)}
    </section>
    <section aria-labelledby="media-review-heading">
      <h2 id="media-review-heading">Solicitações de retirada de fotos</h2>
      <p>Fluxo controlado: solicitação pelo studio, revisão do Platform Owner, execução manual de retirada em etapa posterior.
        Uma aprovação NÃO afirma que a foto já foi excluída do Firebase Storage.</p>
      <button className="button" type="button" disabled={!selected||removalBusy}
        onClick={()=>void refreshRemovalRequests()}>{removalBusy?"Consultando…":"Consultar solicitações"}</button>
      <label>Justificativa da revisão (10–500 caracteres)
        <textarea rows={2} minLength={10} maxLength={500} value={removalReason}
          onChange={event=>setRemovalReason(event.target.value)}/>
      </label>
      {removalMessage&&<p role="status">{removalMessage}</p>}
      <p>Para executar exclusão física, o objeto deve ter sido inspecionado no inventário.
        O ambiente precisa permitir explicitamente a operação no Worker.</p>
      <label>Confirmação explícita
        <input autoComplete="off" placeholder="REMOVER_MIDIA_APROVADA"
          value={deletionConfirmation} onChange={event=>setDeletionConfirmation(event.target.value)}/>
      </label>
      <label>Justificativa da execução (10–500 caracteres)
        <textarea rows={2} minLength={10} maxLength={500} value={deletionReason}
          onChange={event=>setDeletionReason(event.target.value)}/>
      </label>
      {removalRows.map(row=><article className="card" key={row.requestId}>
        <strong>{row.objectPath.split("/").pop()}</strong>
        <p>Estado: {row.status} · Pedido: {row.createdAt.slice(0,10)}</p>
        {row.status==="deletion_in_progress"&&<p>Execução interrompida: confirmar ausência ou geração travada <code>{row.storageGeneration}</code>.</p>}
        {row.status==="deleted_verified"&&<p>Ausência no Storage verificada em {row.deletedAt}. Caches externos não verificados.</p>}
        <p>Motivo: {row.reason}</p>
        {["approved_pending_manual_removal","deletion_in_progress"].includes(row.status)&&
          <button className="button" type="button" disabled={removalBusy||
            deletionConfirmation!=="REMOVER_MIDIA_APROVADA"||
            deletionReason.trim().length<10||
            !(mediaObjects.some(item=>item.path===row.objectPath)||
              (row.status==="deletion_in_progress"&&Boolean(row.storageGeneration)))}
            onClick={()=>void executeMediaRemoval(row)}>Excluir geração aprovada e verificar Storage</button>}
        {row.status==="pending_review"&&<div className="row">
          <button className="button primary" type="button"
            disabled={removalBusy||removalReason.trim().length<10}
            onClick={()=>void reviewRemoval(row.requestId,"approve")}>Aprovar para retirada manual</button>
          <button className="button" type="button"
            disabled={removalBusy||removalReason.trim().length<10}
            onClick={()=>void reviewRemoval(row.requestId,"reject")}>Rejeitar</button>
        </div>}
      </article>)}
    </section>
    <section aria-labelledby="media-pause-heading">
      <h2 id="media-pause-heading">Controle emergencial de uploads</h2>
      <p>Segurança operacional, não é limite por plano. Pausar bloqueia NOVOS uploads no Storage de um tenant, preservando arquivos e leituras existentes.</p>
      <p>Tenant selecionado: <strong>{selected?.name??"Nenhum"}</strong>.
        Estado: <strong>{selected?.mediaUploadsPaused?"Uploads pausados":"Uploads habilitados"}</strong></p>
      <label>Motivo da alteração (10–300 caracteres)
        <input minLength={10} maxLength={300} value={uploadPauseReason}
          onChange={event=>setUploadPauseReason(event.target.value)}/>
      </label>
      <button className="button" type="button"
        disabled={!selected||uploadPauseWorking||uploadPauseReason.trim().length<10}
        onClick={()=>void changeUploadPause(!selected?.mediaUploadsPaused)}>
        {uploadPauseWorking?"Atualizando…":selected?.mediaUploadsPaused?"Reabilitar uploads":"Pausar uploads"}
      </button>
      {uploadPauseMessage&&<p role="status">{uploadPauseMessage}</p>}
    </section>
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
