import {useEffect,useState,type FormEvent} from "react";
import {Link,useParams} from "react-router-dom";
import {useAuth} from "../auth/AuthProvider";
import {repository} from "../data/repository";
import {LoginPanel} from "../components/LoginPanel";
import {TenantTheme} from "../components/TenantTheme";
import type {Tenant} from "../domain/types";

export function StaffInvitePage(){
  const {tenantSlug}=useParams();
  const {user,loading,logout,refreshVerifiedUser,sendVerificationEmail}=useAuth();
  const [tenant,setTenant]=useState<Tenant|null>(null);
  const [tenantLoading,setTenantLoading]=useState(true);
  const [code,setCode]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [working,setWorking]=useState(false);
  const [acceptedRole,setAcceptedRole]=useState("");
  const [verified,setVerified]=useState(false);
  useEffect(()=>{
    let live=true;setTenant(null);setTenantLoading(true);setError("");setAcceptedRole("");
    repository.getTenantBySlug(tenantSlug??"").then(found=>{if(live)setTenant(found);})
      .catch(err=>{if(live)setError(err instanceof Error?err.message:"Studio indisponível.");})
      .finally(()=>{if(live)setTenantLoading(false);});
    return()=>{live=false;};
  },[tenantSlug]);
  useEffect(()=>setVerified(Boolean(user?.emailVerified)),[user?.uid,user?.emailVerified]);

  async function accept(event:FormEvent){
    event.preventDefault();
    if(!tenant||!user||working)return;
    setWorking(true);setError("");setMessage("");setAcceptedRole("");
    try{
      const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!base)throw new Error("Worker não configurado.");
      const response=await fetch(`${base.replace(/\/$/,"")}/api/invitations/accept`,{
        method:"POST",headers:{"content-type":"application/json",
          authorization:`Bearer ${await user.getIdToken(true)}`},
        body:JSON.stringify({tenantId:tenant.id,invitationId:code.trim()}),
      });
      const data=await response.json() as {error?:string;role?:string};
      if(!response.ok)throw new Error(data.error??"Falha ao aceitar convite.");
      setAcceptedRole(data.role??"");setCode("");
      setMessage("Convite aceito com sucesso. Seu papel foi liberado somente neste studio.");
    }catch(err){setError(err instanceof Error?err.message:"Falha ao aceitar convite.");}
    finally{setWorking(false);}
  }
  if(loading||tenantLoading)return <section className="page" role="status">Validando studio e acesso…</section>;
  if(!tenant)return <section className="page">Studio não encontrado. <Link to="/">Voltar</Link></section>;
  return <TenantTheme tenant={tenant}><section className="page narrow">
    <h1>Convite para equipe</h1>
    <p>{tenant.name} — o convite precisa corresponder ao e-mail confirmado da sua conta.</p>
    {error&&<p role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
    {!user?<><LoginPanel title="Entrar para aceitar convite"/>
      <p>Ainda não possui conta? Crie uma conta Firebase pela <Link to={`/customer/${tenant.slug}`}>área de cadastro</Link>.
        Não ative um perfil customer se seu objetivo for apenas aceitar convite de equipe.</p>
    </>:<>
      <p>Conta: <strong>{user.email}</strong> <button className="button" type="button" onClick={()=>void logout()}>Trocar conta</button></p>
      {!verified?<section className="card"><h2>Confirme seu e-mail</h2>
        <p>Somente contas com endereço confirmado podem aceitar convites de equipe.</p>
        <div className="row">
          <button className="button" disabled={working} onClick={()=>void (async()=>{
            try{const result=await refreshVerifiedUser();setVerified(result);
              setMessage(result?"E-mail confirmado.":"Ainda aguardando confirmação.");
            }catch(err){setError(err instanceof Error?err.message:"Erro ao atualizar conta.");}
          })()}>Verificar confirmação</button>
          <button className="button" disabled={working} onClick={()=>void (async()=>{
            try{await sendVerificationEmail();setMessage("E-mail de verificação solicitado.");}
            catch(err){setError(err instanceof Error?err.message:"Falha ao reenviar.");}
          })()}>Reenviar e-mail</button>
        </div>
      </section>:acceptedRole?<section className="card">
        <h2>Vínculo ativado</h2>
        <Link className="button primary" to={acceptedRole==="professional"?
          `/professional/${tenant.slug}`:`/app/${tenant.slug}`}>Abrir minha área</Link>
      </section>:<form className="form" onSubmit={event=>void accept(event)}>
        <label>Código recebido do proprietário
          <input required autoComplete="off" value={code}
            placeholder="00000000-0000-0000-0000-000000000000"
            minLength={36} maxLength={36} onChange={event=>setCode(event.target.value)}/>
        </label>
        <button className="button primary" type="submit" disabled={working}>
          {working?"Validando convite…":"Aceitar convite"}
        </button>
      </form>}
    </>}
    <Link to={`/${tenant.slug}`}>Voltar ao studio</Link>
  </section></TenantTheme>;
}
