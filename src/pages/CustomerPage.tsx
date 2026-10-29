import {useEffect,useState,type FormEvent} from "react";
import {Link,useParams} from "react-router-dom";
import {useAuth} from "../auth/AuthProvider";
import {repository} from "../data/repository";
import {demoModeEnabled} from "../lib/firebase";
import {TenantTheme} from "../components/TenantTheme";
import type {Appointment,Membership,Tenant} from "../domain/types";

const currency=(cents:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);
const apiBase=()=>{const value=import.meta.env.VITE_BOOKING_API_BASE_URL;
  if(!value)throw new Error("Booking Worker não configurado.");
  return value.replace(/\/$/,"");
};

export function CustomerPage(){
  const {tenantSlug}=useParams();
  const {user,loading,configured,signIn,registerCustomer,sendVerificationEmail,refreshVerifiedUser,requestPasswordReset,logout}=useAuth();
  const [tenant,setTenant]=useState<Tenant|null>(null);
  const [tenantLoading,setTenantLoading]=useState(true);
  const [membership,setMembership]=useState<Membership|null>(null);
  const [appointments,setAppointments]=useState<Appointment[]>([]);
  const [dataLoading,setDataLoading]=useState(false);
  const [verified,setVerified]=useState(false);
  const [reloadKey,setReloadKey]=useState(0);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [createAccount,setCreateAccount]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [feedback,setFeedback]=useState("");

  useEffect(()=>{
    let live=true;
    setTenantLoading(true);setTenant(null);setMembership(null);setAppointments([]);
    repository.getTenantBySlug(tenantSlug??"").then(found=>{if(live)setTenant(found);})
      .catch(err=>{if(live)setError(err instanceof Error?err.message:"Não foi possível carregar studio.");})
      .finally(()=>{if(live)setTenantLoading(false);});
    return()=>{live=false;};
  },[tenantSlug]);

  useEffect(()=>{
    let live=true;
    setMembership(null);setAppointments([]);
    setVerified(Boolean(user?.emailVerified));
    if(!user || !tenant || !user.emailVerified)return;
    setDataLoading(true);
    repository.getMembership(tenant.id,user.uid).then(async member=>{
      if(!live)return;
      if(member?.status==="active"&&member.role==="customer"&&member.customerId===user.uid){
        const records=await repository.listAppointmentsForCustomer(tenant.id,user.uid);
        if(live){setMembership(member);setAppointments(records);}
      }else if(live){
        setMembership(member);
      }
    }).catch(err=>{if(live)setError(err instanceof Error?err.message:"Erro ao consultar perfil.");})
      .finally(()=>{if(live)setDataLoading(false);});
    return()=>{live=false;};
  },[tenant?.id,user?.uid,reloadKey]);

  async function authenticate(event:FormEvent){
    event.preventDefault();
    if(working)return;
    setError("");setFeedback("");setWorking(true);
    try{
      if(createAccount){
        await registerCustomer(email,password);
        setFeedback("Conta criada. Confirme o e-mail recebido e depois clique em 'Verificar e-mail'.");
      }else{
        await signIn(email,password);
        setFeedback("Login realizado.");
      }
      setPassword("");
    }catch(err){setError(err instanceof Error?err.message:"Falha de autenticação.");}
    finally{setWorking(false);}
  }
  async function checkVerified(){
    setError("");setFeedback("");setWorking(true);
    try{
      const nowVerified=await refreshVerifiedUser();
      setVerified(nowVerified);
      if(!nowVerified)setFeedback("E-mail ainda não confirmado. Verifique a caixa de entrada.");
      else{setFeedback("E-mail confirmado.");setReloadKey(v=>v+1);}
    }catch(err){setError(err instanceof Error?err.message:"Falha ao verificar e-mail.");}
    finally{setWorking(false);}
  }
  async function enroll(){
    if(!tenant||!user||working)return;
    setError("");setFeedback("");setWorking(true);
    try{
      const response=await fetch(`${apiBase()}/api/customers/enroll`,{
        method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await user.getIdToken(true)}`},
        body:JSON.stringify({tenantId:tenant.id}),
      });
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error??"Falha ao ativar perfil.");
      setFeedback("Seu perfil de cliente está ativo neste studio.");
      setReloadKey(v=>v+1);
    }catch(err){setError(err instanceof Error?err.message:"Falha ao ativar perfil.");}
    finally{setWorking(false);}
  }
  async function cancel(appointmentId:string){
    if(!tenant||!user||working)return;
    setError("");setFeedback("");setWorking(true);
    try{
      const response=await fetch(`${apiBase()}/api/customers/appointments/cancel`,{
        method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await user.getIdToken(true)}`},
        body:JSON.stringify({tenantId:tenant.id,appointmentId}),
      });
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error??"Não foi possível cancelar.");
      const records=await repository.listAppointmentsForCustomer(tenant.id,user.uid);
      setAppointments(records);
      setFeedback("Atendimento cancelado; horário liberado para outras pessoas.");
    }catch(err){setError(err instanceof Error?err.message:"Falha no cancelamento.");}
    finally{setWorking(false);}
  }

  if(loading||tenantLoading)return <section className="page" role="status">Carregando área do cliente…</section>;
  if(!tenant)return <section className="page">Studio indisponível. <Link to="/">Voltar</Link></section>;
  return <TenantTheme tenant={tenant}><section className="page narrow">
    {tenant.kind==="demo"&&<div className="badge">DEMONSTRAÇÃO</div>}
    <h1>Minha agenda · {tenant.name}</h1>
    <p>Consulte e cancele apenas os horários criados com seu perfil confirmado neste studio.
      Reservas antigas feitas sem login não são vinculadas automaticamente por telefone.</p>
    {error&&<p role="alert">{error}</p>}
    {feedback&&<p role="status">{feedback}</p>}
    {demoModeEnabled()||!configured?<p>Para criar um perfil real, ative o Firebase Auth e o Booking Worker em ambiente autorizado.</p>:
    !user?<form className="form" onSubmit={event=>void authenticate(event)}>
      <h2>{createAccount?"Criar conta de cliente":"Entrar como cliente"}</h2>
      <label>E-mail<input required type="email" autoComplete="email" value={email}
        onChange={event=>setEmail(event.target.value)}/></label>
      <label>Senha<input required type="password" minLength={6}
        autoComplete={createAccount?"new-password":"current-password"} value={password}
        onChange={event=>setPassword(event.target.value)}/></label>
      <button className="button primary" type="submit" disabled={working}>{working?"Aguarde…":createAccount?"Cadastrar e verificar e-mail":"Entrar"}</button>
      <button className="button" type="button" onClick={async()=>{
        setError("");setFeedback("");
        try{
          await requestPasswordReset(email);
          setFeedback("Se a conta existir, você receberá o e-mail oficial de recuperação.");
        }catch(err){setError(err instanceof Error?err.message:"Falha ao recuperar conta.");}
      }}>Esqueci minha senha</button>
      <button className="button" type="button" onClick={()=>setCreateAccount(current=>!current)}>
        {createAccount?"Já tenho conta":"Criar uma conta"}
      </button>
    </form>:
    <div>
      <div className="row between"><p>Logado: {user.email}</p>
        <button className="button" onClick={()=>void logout()}>Sair</button></div>
      {!verified?<section className="card">
        <h2>Confirme seu e-mail</h2>
        <p>A confirmação protege a associação dos seus futuros agendamentos à sua conta.</p>
        <div className="row">
          <button className="button primary" disabled={working} onClick={()=>void checkVerified()}>Verificar e-mail</button>
          <button className="button" disabled={working} onClick={()=>void (async()=>{
            try{await sendVerificationEmail();setFeedback("Novo e-mail de verificação solicitado.");}
            catch(err){setError(err instanceof Error?err.message:"Falha ao reenviar e-mail.");}
          })()}>Reenviar verificação</button>
        </div>
      </section>:
      dataLoading?<p role="status">Carregando agendamentos…</p>:
      membership?.status==="active"&&membership.role==="customer"&&membership.customerId===user.uid?<>
        <div className="row between"><h2>Meus agendamentos</h2>
          <Link className="button primary" to={`/${tenant.slug}/book`}>Novo agendamento</Link></div>
        {appointments.length===0?<p>Nenhum horário associado à sua conta. Use o link acima para fazer uma reserva autenticada.</p>:
          <div className="grid cards">{[...appointments].sort((a,b)=>b.startsAt.localeCompare(a.startsAt)).map(item=><article className="card" key={item.id}>
            <h3>{item.startsAt.replace("T"," ").slice(0,16)}</h3>
            <p>Status: {item.status}</p>
            <p>{item.durationSnapshotMin} minutos · {currency(item.priceSnapshotCents)}</p>
            <p>Protocolo: <code>{item.id}</code></p>
            {["pending","confirmed"].includes(item.status)&&<button className="button" disabled={working}
              onClick={()=>void cancel(item.id)}>Cancelar este horário</button>}
          </article>)}</div>}
      </>:
      membership?<p>Esta conta possui outro papel ou está desativada neste studio. Não é possível substituí-lo automaticamente por cliente.</p>:
      <section className="card"><h2>Ativar perfil de cliente</h2>
        <p>Cria somente um vínculo de cliente para este studio, sem acesso administrativo.</p>
        <button className="button primary" disabled={working} onClick={()=>void enroll()}>Ativar meu perfil</button>
      </section>}
    </div>}
    <p><Link to={`/${tenant.slug}`}>Voltar ao studio</Link></p>
  </section></TenantTheme>;
}
