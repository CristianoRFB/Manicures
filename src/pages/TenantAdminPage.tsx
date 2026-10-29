import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { repository } from "../data/repository";
import type { Appointment, Membership, Professional, Service, Tenant } from "../domain/types";
import { resolveTenant } from "../lib/tenantResolver";
import { useAuth } from "../auth/AuthProvider";
import { getLimit, evaluate } from "../commercial/entitlements";
import { LoginPanel } from "../components/LoginPanel";
import {parseBRLToCents} from "../domain/currency";

const ADMIN_ROLES = new Set(["tenant_owner", "tenant_admin"]);

export function TenantAdminPage() {
  const { tenantSlug } = useParams();
  const { user, loading, logout } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [platformOwner, setPlatformOwner] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const auditLogged = useRef(false);
  const [scheduleProId,setScheduleProId]=useState("");
  const [scheduleDay,setScheduleDay]=useState(1);
  const [scheduleClosed,setScheduleClosed]=useState(false);
  const [scheduleStart,setScheduleStart]=useState("09:00");
  const [scheduleEnd,setScheduleEnd]=useState("18:00");
  const [scheduleBreakStart,setScheduleBreakStart]=useState("12:00");
  const [scheduleBreakEnd,setScheduleBreakEnd]=useState("13:00");
  const [newProName, setNewProName] = useState("");
  const [newProServices, setNewProServices] = useState<string[]>([]);
  const [editingServiceId,setEditingServiceId]=useState<string|null>(null);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDescription, setNewServiceDescription] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceMinutes, setNewServiceMinutes] = useState("60");
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [operationError, setOperationError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active=true;
    setTenantLoading(true);
    setTenant(null);
    setMembership(null);
    setPlatformOwner(false);
    setAppointments([]);
    setServices([]);
    setProfessionals([]);
    setLoadError("");
    auditLogged.current=false;
    resolveTenant(repository, tenantSlug).then(value => {
      if(active) setTenant(value);
    }).catch(error => {
      if(active) setLoadError(error instanceof Error ? error.message : "Falha ao carregar tenant.");
    }).finally(()=>{
      if(active) setTenantLoading(false);
    });
    return () => {active=false;};
  }, [tenantSlug]);

  useEffect(() => {
    let active=true;
    setMembership(null);
    setPlatformOwner(false);
    if (tenant && user) {
      Promise.all([
        repository.getMembership(tenant.id,user.uid).catch(()=>null),
        repository.isPlatformOwner(user.uid).catch(()=>false),
      ]).then(([member,isOwner])=>{
        if(!active)return;
        setMembership(member?.tenantId===tenant.id ? member : null);
        setPlatformOwner(isOwner);
      }).catch(error=>{
        if(active)setLoadError(error instanceof Error ? error.message : "Falha ao validar acesso.");
      });
    }
    return ()=>{active=false;};
  }, [tenant?.id, user?.uid]);

  const authorized = useMemo(() =>
    platformOwner || Boolean(membership !== null && membership.tenantId===tenant?.id && membership.status==="active" && ADMIN_ROLES.has(membership.role)),
    [membership,platformOwner,tenant?.id]);

  useEffect(() => {
    if(!tenant || !user || !authorized)return;
    let active=true;
    setAppointments([]);
    setServices([]);
    setProfessionals([]);
    Promise.all([
      repository.listAppointments(tenant.id),
      repository.listServices(tenant.id,{includeInactive:true}),
      repository.listProfessionals(tenant.id,{includeInactive:true}),
    ]).then(([a,s,p])=>{
      if(!active)return;
      setAppointments(a);setServices(s);setProfessionals(p);
    }).catch(error=>{
      if(active)setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados.");
    });
    if(platformOwner && !auditLogged.current){
      auditLogged.current=true;
      repository.recordAuditLog({
        id:crypto.randomUUID(),actorId:user.uid,actorRole:"platform_owner",tenantId:tenant.id,
        action:"platform.view_tenant",resourceType:"tenant",resourceId:tenant.id,createdAt:new Date().toISOString(),
      }).catch(()=>undefined);
    }
    return ()=>{active=false;};
  },[tenant?.id,user?.uid,authorized,platformOwner]);

  async function refresh() {
    if (!tenant) return;
    const [a,s,p] = await Promise.all([repository.listAppointments(tenant.id),
      repository.listServices(tenant.id),repository.listProfessionals(tenant.id,{includeInactive:true})]);
    setAppointments(a);setServices(s);setProfessionals(p);
  }

  const selectedScheduleProfessional=professionals.find(pro=>pro.id===scheduleProId);
  useEffect(()=>{
    if(!scheduleProId && professionals.length)setScheduleProId(professionals[0].id);
  },[professionals,scheduleProId]);
  useEffect(()=>{
    const hours=selectedScheduleProfessional?.weeklyHours?.[String(scheduleDay)];
    const fmt=(min:number)=>`${String(Math.floor(min/60)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`;
    setScheduleClosed(hours?.closed ?? false);
    setScheduleStart(fmt(hours?.startMinute??540));setScheduleEnd(fmt(hours?.endMinute??1080));
    setScheduleBreakStart(fmt(hours?.breakStartMinute??720));
    setScheduleBreakEnd(fmt(hours?.breakEndMinute??780));
  },[scheduleProId,scheduleDay,selectedScheduleProfessional]);

  async function saveSchedule(event:React.FormEvent){
    event.preventDefault();
    if(!tenant||!user||working||!scheduleProId)return;
    const toMinutes=(value:string)=>{
      const [h,m]=value.split(":").map(Number);
      if(!Number.isSafeInteger(h)||!Number.isSafeInteger(m)||h<0||h>23||m<0||m>59)throw new Error("Horário inválido.");
      return h*60+m;
    };
    setWorking(true);setFeedback("");setOperationError("");
    try{
      const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!base)throw new Error("Worker não configurado.");
      const response=await fetch(`${base.replace(/\/$/,"")}/api/admin/professionals/schedule`,{
        method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:tenant.id,professionalId:scheduleProId,weekday:scheduleDay,
          closed:scheduleClosed,startMinute:toMinutes(scheduleStart),endMinute:toMinutes(scheduleEnd),
          breakStartMinute:toMinutes(scheduleBreakStart),breakEndMinute:toMinutes(scheduleBreakEnd)}),
      });
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??"Falha ao atualizar expediente.");
      await refresh();
      setFeedback("Expediente atualizado com auditoria. Agendamentos futuros incompatíveis são protegidos.");
    }catch(error){setOperationError(error instanceof Error?error.message:"Falha ao salvar agenda.");}
    finally{setWorking(false);}
  }

  async function addProfessional(event: React.FormEvent) {
    event.preventDefault();
    if (!tenant || !user || working) return;
    setWorking(true);setFeedback("");setOperationError("");
    try {
      const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if (!base) throw new Error("Worker de equipe indisponível.");
      const response=await fetch(`${base.replace(/\/$/,"")}/api/admin/professionals`, {
        method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:tenant.id,name:newProName.trim(),serviceIds:newProServices}),
      });
      const data=await response.json() as {error?:string};
      if (!response.ok) throw new Error(data.error || "Falha no cadastro.");
      await refresh();setNewProName("");setNewProServices([]);
      setFeedback("Profissional cadastrada com validação de limite e auditoria.");
    } catch(err) {setOperationError(err instanceof Error ? err.message : "Falha de rede.");}
    finally{setWorking(false);}
  }

  async function changeStatus(appointmentId:string,status:Appointment["status"]) {
    if(!tenant||!user||working)return;
    setWorking(true);setFeedback("");setOperationError("");
    try{
      const api=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!api)throw new Error("Booking Worker não configurado.");
      const response=await fetch(`${api.replace(/\/$/,"")}/api/admin/appointments/status`,{
        method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:tenant.id,appointmentId,status}),
      });
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error??"Transição não permitida.");
      await refresh();
      setFeedback("Status do atendimento atualizado com auditoria.");
    }catch(err){setOperationError(err instanceof Error?err.message:"Falha de rede.");}
    finally{setWorking(false);}
  }
  const actionByStatus:Partial<Record<Appointment["status"],Array<{label:string;next:Appointment["status"]}>>> = {
    pending:[{label:"Confirmar",next:"confirmed"},{label:"Cancelar",next:"cancelled"}],
    confirmed:[{label:"Iniciar",next:"in_service"},{label:"No-show",next:"no_show"},{label:"Cancelar",next:"cancelled"}],
    in_service:[{label:"Concluir",next:"completed"}],
  };

  async function toggleProfessional(professionalId:string,active:boolean) {
    if(!tenant || !user || working) return;
    setWorking(true);setFeedback("");setOperationError("");
    try {
      const api=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!api)throw new Error("Booking Worker não configurado.");
      const response=await fetch(`${api.replace(/\/$/,"")}/api/admin/professionals/activation`,{
        method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:tenant.id,professionalId,active}),
      });
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error??"Falha na alteração de profissional.");
      await refresh();setFeedback(active?"Profissional ativada.":"Profissional desativada.");
    } catch(error){setOperationError(error instanceof Error?error.message:"Falha de rede.");}
    finally{setWorking(false);}
  }

  function editService(service:Service){
    setEditingServiceId(service.id);setNewServiceName(service.name);
    setNewServiceDescription(service.description);setNewServicePrice((service.priceCents/100).toFixed(2));
    setNewServiceMinutes(String(service.durationMin));setFeedback("");setOperationError("");
  }
  function clearServiceForm(){
    setEditingServiceId(null);setNewServiceName("");setNewServiceDescription("");setNewServicePrice("");setNewServiceMinutes("60");
  }
  async function toggleService(service:Service){
    if(!tenant||working)return;
    setWorking(true);setOperationError("");setFeedback("");
    try{
      await repository.updateService(tenant.id,service.id,{name:service.name,description:service.description,
        priceCents:service.priceCents,durationMin:service.durationMin,active:!service.active});
      await refresh();clearServiceForm();
      setFeedback(service.active?"Serviço arquivado sem apagar histórico.":"Serviço reativado.");
    }catch(err){setOperationError(err instanceof Error?err.message:"Falha no serviço.");}
    finally{setWorking(false);}
  }

  async function addService(event: React.FormEvent) {
    event.preventDefault();
    if (!tenant || working) return;
    setWorking(true);setFeedback("");setOperationError("");
    try {
      const priceCents=parseBRLToCents(newServicePrice);
      const durationMin=Number(newServiceMinutes);
      if(editingServiceId){
        const existing=services.find(s=>s.id===editingServiceId);
        if(!existing)throw new Error("Serviço não encontrado.");
        await repository.updateService(tenant.id,editingServiceId,{
          name:newServiceName,description:newServiceDescription,priceCents,durationMin,active:existing.active,
        });
      }else{
        await repository.createService(tenant.id,{name:newServiceName,description:newServiceDescription,priceCents,durationMin});
      }
      await refresh();clearServiceForm();
      setFeedback(editingServiceId?"Serviço atualizado; agendamentos anteriores preservam o preço original.":"Serviço cadastrado.");
    } catch(err) {setOperationError(err instanceof Error ? err.message : "Falha de rede.");}
    finally{setWorking(false);}
  }

  if (loading) return <section className="page">Validando sessão…</section>;
  if (tenantLoading) return <section className="page" role="status">Carregando tenant…</section>;
  if (!user) return <LoginPanel title="Painel do tenant" />;
  if (loadError) return <section className="page" role="alert">{loadError}</section>;
  if (!tenant) return <section className="page">Tenant não encontrado ou suspenso.</section>;
  if (!authorized) return <section className="page narrow"><div className="badge">ACESSO NEGADO</div><h1>{tenant.name}</h1><p>Sua membership não autoriza administrar este tenant.</p><button className="button" onClick={() => void logout()}>Sair</button></section>;

  return (
    <section className="page">
      <div className="row between"><div><div className="badge">{platformOwner ? "PLATFORM OWNER" : membership?.role}</div><h1>{tenant.name}</h1></div><button className="button" onClick={() => void logout()}>Sair</button></div>
      <div className="stats">
        <div className="stat"><strong>{appointments.length}</strong><span>agendamentos</span></div>
        <div className="stat"><strong>{professionals.filter(pro=>pro.active).length}</strong><span>profissionais ativas</span></div>
        <div className="stat"><strong>{services.length}</strong><span>serviços</span></div>
      </div>
      <div className="row">
        <p><strong>Plano:</strong> {tenant.commercial?.planId || "legado sem atribuição"}</p>
        <p><strong>Status:</strong> {tenant.commercial?.subscriptionStatus || "pendente"}</p>
        <p><strong>Limite de profissionais:</strong> {professionals.filter(pro=>pro.active).length}/{getLimit(tenant,"professionals_active") ?? "sem teto"}</p>
      </div>
      <h2>Serviços</h2>
      <div className="grid cards">
        {services.map(service=><article className="card" key={service.id}>
          <h3>{service.name}</h3>
          <p>{service.durationMin} min — {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(service.priceCents/100)}</p>
          <p>{service.active?"Ativo":"Arquivado"}</p>
          <div className="row">
            <button className="button" type="button" disabled={working} onClick={()=>editService(service)}>Editar</button>
            <button className="button" type="button" disabled={working} onClick={()=>void toggleService(service)}>{service.active?"Arquivar":"Reativar"}</button>
          </div>
        </article>)}
      </div>
      {!services.length && <p>Nenhum serviço ativo cadastrado.</p>}
      <form className="form narrow" onSubmit={(event)=>void addService(event)}>
        <h3>{editingServiceId?"Editar serviço":"Cadastrar serviço"}</h3>
        <label>Nome do serviço<input value={newServiceName} minLength={2} maxLength={100} required onChange={e=>setNewServiceName(e.target.value)} /></label>
        <label>Descrição<input value={newServiceDescription} maxLength={400} onChange={e=>setNewServiceDescription(e.target.value)} /></label>
        <label>Preço em reais<input value={newServicePrice} inputMode="decimal" placeholder="49,90" required onChange={e=>setNewServicePrice(e.target.value)} /></label>
        <label>Duração (minutos)<input type="number" min={15} max={480} step={15} value={newServiceMinutes} required onChange={e=>setNewServiceMinutes(e.target.value)} /></label>
        <div className="row"><button className="button primary" disabled={working || !evaluate(tenant,"services.manage").allowed} type="submit">{working?"Salvando…":editingServiceId?"Salvar alterações":"Adicionar serviço"}</button>
        {editingServiceId&&<button className="button" type="button" onClick={clearServiceForm}>Cancelar edição</button>}</div>
      </form>
      <h2>Profissionais</h2>
      <div className="grid cards">{professionals.map(pro=><article className="card" key={pro.id}>
        <h3>{pro.name}</h3>
        <p>{pro.active?"Ativa":"Inativa"} — {pro.serviceIds.length} serviço(s) associado(s)</p>
        <button className="button" type="button" disabled={working || !evaluate(tenant,"professionals.manage").allowed}
          onClick={()=>void toggleProfessional(pro.id,!pro.active)}>
          {pro.active?"Desativar":"Reativar"}
        </button>
      </article>)}</div>
      <form className="form narrow" onSubmit={(event)=>void addProfessional(event)}>
        <h3>Cadastrar profissional</h3>
        <label>Nome<input required minLength={2} maxLength={100} value={newProName} onChange={e=>setNewProName(e.target.value)} /></label>
        <fieldset><legend>Serviços que realiza</legend>{services.map(service=>
          <label key={service.id} className="row">
            <input type="checkbox" checked={newProServices.includes(service.id)} onChange={e=>setNewProServices(curr=>e.target.checked?[...curr,service.id]:curr.filter(id=>id!==service.id))} />
            {service.name}
          </label>)}
        </fieldset>
        <button className="button primary" type="submit" disabled={working || !evaluate(tenant,"professionals.manage").allowed}>{working?"Salvando…":"Adicionar profissional"}</button>
      </form>
      <h2>Horários de atendimento por profissional</h2>
      <form className="form narrow" onSubmit={(event)=>void saveSchedule(event)}>
        <label>Profissional
          <select value={scheduleProId} onChange={event=>setScheduleProId(event.target.value)} required>
            {professionals.map(pro=><option key={pro.id} value={pro.id}>{pro.name}</option>)}
          </select>
        </label>
        <label>Dia da semana
          <select value={scheduleDay} onChange={event=>setScheduleDay(Number(event.target.value))}>
            {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"].map((day,i)=><option key={day} value={i}>{day}</option>)}
          </select>
        </label>
        <label className="row"><input type="checkbox" checked={scheduleClosed} onChange={event=>setScheduleClosed(event.target.checked)}/>Dia fechado</label>
        <label>Início<input type="time" value={scheduleStart} required onChange={event=>setScheduleStart(event.target.value)}/></label>
        <label>Fim<input type="time" value={scheduleEnd} required onChange={event=>setScheduleEnd(event.target.value)}/></label>
        <label>Início da pausa<input type="time" value={scheduleBreakStart} required onChange={event=>setScheduleBreakStart(event.target.value)}/></label>
        <label>Fim da pausa<input type="time" value={scheduleBreakEnd} required onChange={event=>setScheduleBreakEnd(event.target.value)}/></label>
        <button type="submit" className="button primary" disabled={working||!scheduleProId}>Salvar expediente</button>
      </form>
      {!evaluate(tenant,"services.manage").allowed && <p>Cadastro bloqueado pelo estado comercial ou configuração deste tenant.</p>}
      {feedback && <p role="status">{feedback}</p>}
      {operationError && <p role="alert">{operationError}</p>}
      <h2>Agenda</h2>
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Horário</th><th>Status</th><th>Ações</th></tr></thead><tbody>
        {[...appointments].sort((a,b) => a.startsAt.localeCompare(b.startsAt)).map((a) => (
          <tr key={a.id}><td>{a.customerName}</td><td>{services.find((s) => s.id === a.serviceId)?.name ?? a.serviceId}</td><td>{professionals.find((p) => p.id === a.professionalId)?.name ?? a.professionalId}</td><td>{a.startsAt.replace("T", " ").slice(0,16)}</td><td>{a.status}</td>
            <td className="row">{(actionByStatus[a.status]??[]).map(action=><button
              type="button" className="button" key={action.next} disabled={working}
              onClick={()=>void changeStatus(a.id,action.next)}>{action.label}</button>)}</td>
          </tr>
        ))}
      </tbody></table></div>
    </section>
  );
}
