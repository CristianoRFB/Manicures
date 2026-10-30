import {useCallback,useEffect,useState,type FormEvent} from "react";
import {getDownloadURL,listAll,ref,uploadBytes} from "firebase/storage";
import {getFirebaseServices} from "../lib/firebase";
import {normalizePortfolioImage,validatePortfolioSource} from "../lib/media";

type PortfolioImage={path:string;url:string};

export function StudioPortfolio({tenantId,canManage=false}:{tenantId:string;canManage?:boolean}){
  const [photos,setPhotos]=useState<PortfolioImage[]>([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<File|null>(null);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [revision,setRevision]=useState(0);
  const reload=useCallback(async()=>{
    const firebase=getFirebaseServices();
    if(!firebase)return [];
    const folder=ref(firebase.storage,`tenants/${tenantId}/public/portfolio`);
    const items=await listAll(folder);
    const result=await Promise.all(items.items.map(async item=>({
      path:item.fullPath,url:await getDownloadURL(item)
    })));
    return result.sort((a,b)=>a.path.localeCompare(b.path));
  },[tenantId]);
  useEffect(()=>{
    let alive=true;
    setPhotos([]);setError("");setLoading(true);
    reload().then(data=>{if(alive)setPhotos(data);})
      .catch(err=>{if(alive)setError(err instanceof Error?err.message:"Não foi possível carregar imagens.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[reload,revision]);

  async function upload(event:FormEvent){
    event.preventDefault();
    const firebase=getFirebaseServices();
    if(!firebase||!selected||sending)return;
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

  return <section aria-labelledby="portfolio-heading">
    <h2 id="portfolio-heading">Portfólio de trabalhos</h2>
    {canManage&&<form className="form narrow" onSubmit={event=>void upload(event)}>
      <p>Fotos reais JPEG/PNG/WebP até 5 MiB; o navegador reduz a resolução e converte para WebP, sem enviar metadados originais (como GPS/EXIF). Conteúdo persistente.</p>
      <label>Nova foto
        <input type="file" accept="image/png,image/jpeg,image/webp"
          onChange={event=>setSelected(event.target.files?.[0]??null)}/>
      </label>
      <button type="submit" className="button primary" disabled={!selected||sending}>
        {sending?"Publicando…":"Publicar foto"}
      </button>
    </form>}
    {message&&<p role="status">{message}</p>}
    {error&&<p role="alert">{error}</p>}
    {loading?<p role="status">Carregando fotos publicadas…</p>:photos.length>0?
      <div className="portfolio-grid">{photos.map(photo=><figure className="portfolio-photo" key={photo.path}>
        <img src={photo.url} alt="Trabalho publicado no portfólio do studio" loading="lazy" decoding="async"/>
      </figure>)}</div>:
      <p>{getFirebaseServices()?"O studio ainda não publicou fotos no portfólio.":"Portfólio real disponível somente com Firebase configurado."}</p>}
  </section>;
}
