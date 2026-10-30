import {useEffect,useState} from "react";
import {useParams,Link} from "react-router-dom";
import {useAuth} from "../auth/AuthProvider";
import {repository} from "../data/repository";
import {LoginPanel} from "../components/LoginPanel";
import {TenantTheme} from "../components/TenantTheme";
import type {Appointment,Membership,Tenant} from "../domain/types";

const actions:Partial<Record<Appointment["status"],Array<{name:string;status:Appointment["status"]}>>> = {
  pending:[{name:"Confirmar",status:"confirmed"},{name:"Cancelar",status:"cancelled"}],
  confirmed:[{name:"Iniciar",status:"in_service"},{name:"Não compareceu",status:"no_show"},{name:"Cancelar",status:"cancelled"}],
  in_service:[{name:"Concluir",status:"completed"}],
};

export function ProfessionalPage(){
  const {tenantSlug}=useParams();
  const {user,loading,logout}=useAuth();
  const [tenant,setTenant]=useState<Tenant|null>(null);
  const [member,setMember]=useState<Membership|null>(null);
  const [appointments,setAppointments]=useState<Appointment[]>([]);
  const [pending,setPending]=useState(true);
  const [error,setError]=useState("");
  const [feedback,setFeedback]=useState("");
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    let active=true;
    setPending(true);setError("");setTenant(null);setMember(null);setAppointments([]);
    if(!user){setPending(false);return;}
    resolve();
    async function resolve(){
      try{
        const resolved=await repository.getTenantBySlug(tenantSlug??"");
        if(!active)return;
        if(!resolved){setPending(false);return;}
        const membership=await repository.getMembership(resolved.id,user!.uid);
        if(!active)return;
        setTenant(resolved);
        if(membership?.status==="active"&&membership.role==="professional"&&
           membership.tenantId===resolved.id&&membership.professionalId){
          setMember(membership);
          const rows=await repository.listAppointmentsForProfessional(resolved.id,membership.professionalId);
          if(active)setAppointments(rows);
        }
      }catch(err){if(active)setError(err instanceof Error?err.message:"Falha na agenda.");}
      finally{if(active)setPending(false);}
    }
    return()=>{active=false;};
  },[tenantSlug,user?.uid]);

  async function changeStatus(appointment:Appointment,status:Appointment["status"]){
    if(!user||!tenant||!member||saving)return;
    setSaving(true);setError("");setFeedback("");
    try{
      const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!base)throw new Error("Worker não configurado.");
      const response=await fetch(`${base.replace(/\/$/,"")}/api/admin/appointments/status`,{
        method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId:tenant.id,appointmentId:appointment.id,status}),
      });
      const body=await response.json() as {error?:string};
      if(!response.ok)throw new Error(body.error??"Ação não permitida.");
      const rows=await repository.listAppointmentsForProfessional(tenant.id,member.professionalId!);
      setAppointments(rows);
      setFeedback("Atendimento atualizado.");
    }catch(err){setError(err instanceof Error?err.message:"Falha ao atualizar.");}
    finally{setSaving(false);}
  }
  if(loading||pending)return <section className="page" role="status">Validando agenda profissional…</section>;
  if(!user)return <LoginPanel title="Acesso profissional" />;
  if(error&&!tenant)return <section className="page" role="alert">{error}</section>;
  if(!tenant)return <section className="page">Studio não encontrado.</section>;
  if(!member)return <section className="page narrow"><h1>Acesso profissional negado</h1>
    <p>Sua conta não possui membership profissional ativa neste studio.</p>
    <button className="button" onClick={()=>void logout()}>Sair</button></section>;
  const ordered=[...appointments].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  const upcoming=ordered.filter(a=>["pending","confirmed"].includes(a.status));
  return <TenantTheme tenant={tenant}><section className="page">
    <div className="row between"><div><div className="badge">AGENDA PROFISSIONAL</div>
      <h1>{tenant.name}</h1><p>Somente atendimentos associados ao seu perfil.</p></div>
      <button className="button" type="button" onClick={()=>void logout()}>Sair</button></div>
    <div className="stats">
      <div className="stat"><strong>{upcoming.length}</strong><span>pendentes/confirmados</span></div>
      <div className="stat"><strong>{ordered.filter(a=>a.status==="completed").length}</strong><span>concluídos</span></div>
    </div>
    {feedback&&<p role="status">{feedback}</p>}{error&&<p role="alert">{error}</p>}
    {ordered.length===0?<p>Nenhum atendimento atribuído a esta profissional.</p>:
      <div className="grid cards">{ordered.map(a=><article className="card" key={a.id}>
        <h3>{a.customerName}</h3><p>{a.startsAt.replace("T"," ").slice(0,16)} · {a.durationSnapshotMin} min</p>
        <p>Telefone: {a.customerPhone} · Status: {a.status}</p>
        <p>Valor original: {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(a.priceSnapshotCents/100)}</p>
        <div className="row">{(actions[a.status]??[]).map(action=><button type="button" key={action.status}
          className="button" disabled={saving} onClick={()=>void changeStatus(a,action.status)}>{action.name}</button>)}</div>
      </article>)}</div>}
    <Link to={`/${tenant.slug}`}>Ver página pública</Link>
  </section></TenantTheme>;
}
