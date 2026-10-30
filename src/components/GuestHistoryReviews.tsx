import {useEffect,useState} from "react";
import type {User} from "firebase/auth";
import type {Tenant} from "../domain/types";

type Claim={claimId:string;appointmentId:string;customerId:string;status:string;createdAt:string;reviewedAt:string};
const api=()=>{
  const url=import.meta.env.VITE_BOOKING_API_BASE_URL;
  if(!url)throw new Error("Booking Worker não configurado.");
  return url.replace(/\/$/,"");
};

export function GuestHistoryReviews({tenant,user}:{tenant:Tenant;user:User}){
  const [claims,setClaims]=useState<Claim[]>([]);
  const [reason,setReason]=useState("");
  const [verified,setVerified]=useState(false);
  const [method,setMethod]=useState<"in_person"|"independent_callback">("in_person");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  async function call(action:"list"|"review",body:Record<string,unknown>){
    const response=await fetch(`${api()}/api/admin/guest-claims/${action}`,{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await user.getIdToken()}`},
      body:JSON.stringify({tenantId:tenant.id,...body}),
    });
    const payload=await response.json() as {error?:string;claims?:Claim[]};
    if(!response.ok)throw new Error(payload.error??"Falha ao consultar pedidos.");
    return payload;
  }
  async function refresh(){
    setBusy(true);setError("");
    try{setClaims((await call("list",{})).claims??[]);}
    catch(err){setError(err instanceof Error?err.message:"Falha ao consultar.");}
    finally{setBusy(false);}
  }
  useEffect(()=>{
    let alive=true;
    setClaims([]);setMessage("");setError("");
    call("list",{}).then(result=>{if(alive)setClaims(result.claims??[]);})
      .catch(err=>{if(alive)setError(err instanceof Error?err.message:"Falha ao carregar solicitações.");});
    return()=>{alive=false;};
  },[tenant.id,user.uid]);
  async function review(item:Claim,decision:"approve"|"reject"){
    if(busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      await call("review",{claimId:item.claimId,decision,reason:reason.trim(),
        ...(decision==="approve"?{identityVerifiedOffline:verified,verificationMethod:method}:{})});
      setClaims((await call("list",{})).claims??[]);
      setReason("");setVerified(false);
      setMessage(decision==="approve"?
        "Vínculo criado depois da verificação independente. Histórico anterior preservado.":
        "Pedido recusado sem vincular o agendamento.");
    }catch(err){setError(err instanceof Error?err.message:"Não foi possível revisar.");}
    finally{setBusy(false);}
  }
  return <section aria-labelledby="guest-history-heading">
    <h2 id="guest-history-heading">Solicitações de histórico antigo</h2>
    <p>O protocolo e o telefone informado pelo cliente <strong>não comprovam titularidade</strong>.
      Antes de aprovar, confirme a identidade presencialmente ou por retorno a um contato já registrado,
      sem depender dos dados informados no pedido.</p>
    <button className="button" type="button" onClick={()=>void refresh()} disabled={busy}>
      {busy?"Consultando…":"Atualizar pedidos"}</button>
    <label>Justificativa da revisão
      <textarea rows={2} minLength={10} maxLength={500} value={reason}
        onChange={e=>setReason(e.target.value)}/></label>
    <label>Método independente de verificação
      <select value={method} onChange={e=>setMethod(e.target.value as typeof method)}>
        <option value="in_person">Conferência presencial</option>
        <option value="independent_callback">Retorno por contato já registrado</option>
      </select>
    </label>
    <label className="row"><input type="checkbox" checked={verified}
      onChange={e=>setVerified(e.target.checked)}/>
      Confirmo que verifiquei a identidade do titular fora desta solicitação.</label>
    {error&&<p role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
    {!claims.length?<p>Sem solicitações de histórico registradas.</p>:
      <div className="grid cards">{claims.map(item=><article className="card" key={item.claimId}>
        <h3>Reserva: <code>{item.appointmentId}</code></h3>
        <p>Conta solicitante: <code>{item.customerId}</code></p>
        <p>Estado: {item.status}</p>
        <p>Pedido em: {item.createdAt}</p>
        {item.status==="pending_review"&&<div className="row">
          <button type="button" className="button primary"
            disabled={busy||!verified||reason.trim().length<10}
            onClick={()=>void review(item,"approve")}>Aprovar após verificar</button>
          <button type="button" className="button" disabled={busy||reason.trim().length<10}
            onClick={()=>void review(item,"reject")}>Rejeitar</button>
        </div>}
      </article>)}</div>}
  </section>;
}
