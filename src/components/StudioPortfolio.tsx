import {useCallback,useEffect,useState,type FormEvent} from "react";
import {getDownloadURL,list,ref,uploadBytes} from "firebase/storage";
import {getFirebaseServices} from "../lib/firebase";
import {useAuth} from "../auth/AuthProvider";
import {normalizePortfolioImage,validatePortfolioSource} from "../lib/media";

type PortfolioImage={path:string;url:string};

export function StudioPortfolio({tenantId,canManage=false,uploadsPaused=false}:{
  tenantId:string;canManage?:boolean;uploadsPaused?:boolean;
}){
  const {user}=useAuth();
  const [removalPath,setRemovalPath]=useState("");
  const [removalReason,setRemovalReason]=useState("");
  const [removalWorking,setRemovalWorking]=useState(false);
  const [photos,setPhotos]=useState<PortfolioImage[]>([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<File|null>(null);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [revision,setRevision]=useState(0);
  const [nextPageToken,setNextPageToken]=useState<string|null>(null);
  const [loadingMore,setLoadingMore]=useState(false);
  const loadPage=useCallback(async(pageToken?:string)=>{
    const firebase=getFirebaseServices();
    if(!firebase)return {items:[] as PortfolioImage[],token:null as string|null};
    const folder=ref(firebase.storage,`tenants/${tenantId}/public/portfolio`);
    // Do not enumerate every file or download every URL on a public visit.
    const page=await list(folder,{maxResults:12,...(pageToken?{pageToken}:{})});
    const items=await Promise.all(page.items.map(async item=>({
      path:item.fullPath,url:await getDownloadURL(item),
    })));
    return {items:items.sort((a,b)=>a.path.localeCompare(b.path)),token:page.nextPageToken??null};
  },[tenantId]);
  useEffect(()=>{
    let alive=true;
    setPhotos([]);setError("");setLoading(true);setNextPageToken(null);
    loadPage().then(page=>{if(alive){setPhotos(page.items);setNextPageToken(page.token);}})
      .catch(err=>{if(alive)setError(err instanceof Error?err.message:"Não foi possível carregar imagens.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[loadPage,revision]);
  async function loadMore(){
    if(!nextPageToken||loadingMore)return;
    setLoadingMore(true);setError("");
    try{
      const page=await loadPage(nextPageToken);
      setPhotos(old=>{
        const seen=new Set(old.map(photo=>photo.path));
        return [...old,...page.items.filter(item=>!seen.has(item.path))];
      });
      setNextPageToken(page.token);
    }catch(err){setError(err instanceof Error?err.message:"Não foi possível carregar mais fotos.");}
    finally{setLoadingMore(false);}
  }

  async function upload(event:FormEvent){
    event.preventDefault();
    const firebase=getFirebaseServices();
    if(!firebase||!selected||sending||uploadsPaused)return;
    try{validatePortfolioSource(selected);}
    catch(err){setError(err instanceof Error?err.message:"Arquivo inválido.");return;}
    setSending(true);setError("");setMessage("");
    try{
      const normalized=await normalizePortfolioImage(selected);
      const id=crypto.randomUUID();
      const target=ref(firebase.storage,`tenants/${tenantId}/public/portfolio/${id}.webp`);
      await uploadBytes(target,normalized,{
        contentType:"image/webp",
        customMetadata:{mediaClass:"PERSISTENT_BUSINESS",policyVersion:"1",source:"studio_admin",metadataPolicy:"reencoded_no_exif"},
      });
      setSelected(null);setRevision(value=>value+1);
      setMessage("Foto publicada em WebP otimizado, sem metadados originais. Nenhuma exclusão automática está ativada.");
    }catch(err){setError(err instanceof Error?err.message:"Upload falhou.");}
    finally{setSending(false);}
  }

  async function requestRemoval(event:FormEvent){
    event.preventDefault();
    if(!user||!canManage||removalWorking||!removalPath)return;
    setRemovalWorking(true);setError("");setMessage("");
    try{
      const api=import.meta.env.VITE_BOOKING_API_BASE_URL;
      if(!api)throw new Error("Worker não configurado.");
      const response=await fetch(`${api.replace(/\/$/,"")}/api/media/removal/request`,{
        method:"POST",headers:{"content-type":"application/json",
          authorization:`Bearer ${await user.getIdToken()}`},
        body:JSON.stringify({tenantId,objectPath:removalPath,reason:removalReason.trim()}),
      });
      const data=await response.json() as {error?:string;requestId?:string};
      if(!response.ok)throw new Error(data.error??"Não foi possível registrar a solicitação.");
      setMessage(`Solicitação ${data.requestId??""} registrada para revisão da plataforma. A imagem NÃO foi apagada.`);
      setRemovalPath("");setRemovalReason("");
    }catch(err){setError(err instanceof Error?err.message:"Falha ao solicitar remoção.");}
    finally{setRemovalWorking(false);}
  }

  return <section aria-labelledby="portfolio-heading">
    <h2 id="portfolio-heading">Portfólio de trabalhos</h2>
    {canManage&&uploadsPaused&&<p role="alert">Novos uploads pausados pela plataforma. Fotos existentes continuam preservadas.</p>}
    {canManage&&<form className="form narrow" onSubmit={event=>void upload(event)}>
      <p>Fotos reais JPEG/PNG/WebP até 5 MiB; o navegador reduz a resolução e converte para WebP, sem enviar metadados originais (como GPS/EXIF). Conteúdo persistente.</p>
      <label>Nova foto
        <input type="file" accept="image/png,image/jpeg,image/webp"
          onChange={event=>setSelected(event.target.files?.[0]??null)}/>
      </label>
      <button type="submit" className="button primary" disabled={!selected||sending||uploadsPaused}>
        {sending?"Publicando…":"Publicar foto"}
      </button>
    </form>}
    {removalPath&&canManage&&<form className="form narrow" onSubmit={event=>void requestRemoval(event)}>
      <h3>Solicitar retirada de foto</h3>
      <p>Arquivo: <code>{removalPath.split("/").pop()}</code>. A solicitação é auditada e exige revisão da plataforma. Não exclui dados automaticamente.</p>
      <label>Justificativa (mínimo 10 caracteres)
        <textarea required minLength={10} maxLength={500} rows={3}
          value={removalReason} onChange={event=>setRemovalReason(event.target.value)}/>
      </label>
      <div className="row">
        <button className="button primary" type="submit" disabled={removalWorking||removalReason.trim().length<10}>
          {removalWorking?"Registrando…":"Enviar para revisão"}
        </button>
        <button className="button" type="button" onClick={()=>{setRemovalPath("");setRemovalReason("");}}>Cancelar</button>
      </div>
    </form>}
    {message&&<p role="status">{message}</p>}
    {error&&<p role="alert">{error}</p>}
    {loading?<p role="status">Carregando fotos publicadas…</p>:photos.length>0?
      <div className="portfolio-grid">{photos.map(photo=><figure className="portfolio-photo" key={photo.path}>
        <img src={photo.url} alt="Trabalho publicado no portfólio do studio" loading="lazy" decoding="async"/>
      {canManage&&<figcaption><button className="button" type="button"
          onClick={()=>{setRemovalPath(photo.path);setRemovalReason("");setMessage("");setError("");}}>
          Solicitar retirada
        </button></figcaption>}
      </figure>)}
        {nextPageToken&&<button className="button" type="button" disabled={loadingMore}
          onClick={()=>void loadMore()}>{loadingMore?"Carregando…":"Carregar mais fotos"}</button>}
      </div>:
      <p>{getFirebaseServices()?"O studio ainda não publicou fotos no portfólio.":"Portfólio real disponível somente com Firebase configurado."}</p>}
  </section>;
}
