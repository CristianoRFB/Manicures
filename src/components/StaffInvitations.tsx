import {useEffect,useState,type FormEvent} from "react";
import type {User} from "firebase/auth";
import type {Professional,Tenant} from "../domain/types";

type InviteRecord={
  invitationId:string;email:string;role:string;professionalId:string;
  status:string;expiresAtEpochMs:number;createdAt:string;
};
const base=()=>{const url=import.meta.env.VITE_BOOKING_API_BASE_URL;
  if(!url)throw new Error("Booking Worker não configurado.");
  return url.replace(/\/$/,"");
};

export function StaffInvitations({tenant,user,professionals}:{
  tenant:Tenant;user:User;professionals:Professional[];
}){
  const [email,setEmail]=useState("");
  const [role,setRole]=useState<"tenant_admin"|"professional">("professional");
  const [professionalId,setProfessionalId]=useState("");
  const [invites,setInvites]=useState<InviteRecord[]>([]);
  const [loading,setLoading]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [feedback,setFeedback]=useState("");
  const [issued,setIssued]=useState("");
  async function call(action:"create"|"list"|"revoke",body:Record<string,unknown>){
    const response=await fetch(`${base()}/api/admin/invitations/${action}`,{
      method:"POST",headers:{"content-type":"application/json",
        authorization:`Bearer ${await user.getIdToken()}`},
      body:JSON.stringify({tenantId:tenant.id,...body}),
    });
    const data=await response.json() as {error?:string;invitationId?:string;invitations?:InviteRecord[]};
    if(!response.ok)throw new Error(data.error??"Falha de acesso ao Worker.");
    return data;
  }
  async function load(){
    setLoading(true);
    try{setInvites((await call("list",{})).invitations??[]);}
    catch(err){setError(err instanceof Error?err.message:"Não foi possível listar convites.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{
    let live=true;
    setInvites([]);setIssued("");setError("");
    setLoading(true);
    call("list",{}).then(data=>{if(live)setInvites(data.invitations??[]);})
      .catch(err=>{if(live)setError(err instanceof Error?err.message:"Não foi possível listar convites.");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[tenant.id,user.uid]);
  async function issue(event:FormEvent){
    event.preventDefault();
    if(working)return;
    setError("");setFeedback("");setIssued("");setWorking(true);
    try{
      const result=await call("create",{email,role,...(role==="professional"?{professionalId}:{})});
      setIssued(result.invitationId??"");setEmail("");
      setFeedback("Convite emitido por 48 horas. Entregue o código por canal privado ao destinatário; o e-mail não é enviado automaticamente.");
      await load();
    }catch(err){setError(err instanceof Error?err.message:"Não foi possível criar convite.");}
    finally{setWorking(false);}
  }
  async function revoke(invitationId:string){
    if(working)return;
    setError("");setFeedback("");setWorking(true);
    try{
      await call("revoke",{invitationId});
      setFeedback("Convite revogado sem conceder acesso.");
      await load();
    }catch(err){setError(err instanceof Error?err.message:"Não foi possível revogar.");}
    finally{setWorking(false);}
  }
  const selected=professionals.filter(pro=>pro.active);
  return <section aria-label="Convites seguros da equipe">
    <h2>Convidar administradora ou profissional</h2>
    <p>O destinatário precisa ter conta Firebase com o mesmo e-mail, verificado. O código vence em 48h, é válido uma vez e não concede acesso sem autenticação.</p>
    <form className="form narrow" onSubmit={event=>void issue(event)}>
      <label>E-mail de destino<input required type="email" maxLength={254} value={email}
        onChange={event=>setEmail(event.target.value)}/></label>
      <label>Papel
        <select value={role} onChange={event=>{setRole(event.target.value as typeof role);setProfessionalId("");}}>
          <option value="professional">Profissional</option>
          <option value="tenant_admin">Administrador adicional (sujeito ao limite do plano)</option>
        </select>
      </label>
      {role==="professional"&&<label>Perfil profissional existente
        <select required value={professionalId} onChange={event=>setProfessionalId(event.target.value)}>
          <option value="">Selecione</option>
          {selected.map(pro=><option key={pro.id} value={pro.id}>{pro.name}</option>)}
        </select>
      </label>}
      <button className="button primary" type="submit"
        disabled={working||(role==="professional"&&!professionalId)}>
        {working?"Emitindo…":"Gerar convite seguro"}
      </button>
    </form>
    {issued&&<div className="card">
      <strong>Código de convite — entregue somente ao destinatário</strong>
      <code>{issued}</code>
      <p>Abrir <a href={`/invite/${tenant.slug}`}>área de aceite do studio</a> e informar o código. Não publicar este código.</p>
      <button className="button" type="button" onClick={()=>{
        void navigator.clipboard.writeText(issued).then(()=>setFeedback("Código copiado. Compartilhe por canal privado."))
          .catch(()=>setError("Copie manualmente o código acima."));
      }}>Copiar código</button>
    </div>}
    {error&&<p role="alert">{error}</p>}
    {feedback&&<p role="status">{feedback}</p>}
    <h3>Convites emitidos</h3>
    {loading?<p role="status">Carregando convites…</p>:
      invites.length===0?<p>Nenhum convite registrado.</p>:
      <div className="table-wrap"><table><thead><tr>
        <th>E-mail</th><th>Papel</th><th>Estado</th><th>Validade</th><th>Ações</th>
      </tr></thead><tbody>{invites.map(item=><tr key={item.invitationId}>
        <td>{item.email}</td><td>{item.role==="professional"?"Profissional":"Admin"}</td>
        <td>{item.status}</td>
        <td>{Number.isFinite(item.expiresAtEpochMs)?new Date(item.expiresAtEpochMs).toLocaleString("pt-BR"):"—"}</td>
        <td>{item.status==="pending"&&item.expiresAtEpochMs>Date.now()&&<>
          <button className="button" type="button" disabled={working} onClick={()=>{
            setIssued(item.invitationId);setFeedback("Código carregado para entrega privada.");
          }}>Código</button>
          <button className="button" type="button" disabled={working}
            onClick={()=>void revoke(item.invitationId)}>Revogar</button>
        </>}</td>
      </tr>)}</tbody></table></div>}
  </section>;
}
