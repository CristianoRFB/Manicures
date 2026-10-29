import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { repository } from "../data/repository";
import type { Service, Tenant } from "../domain/types";
import { resolveTenant } from "../lib/tenantResolver";
import { TenantTheme } from "../components/TenantTheme";
import { StudioPortfolio } from "../components/StudioPortfolio";

export function TenantPublicPage() {
  const { tenantSlug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null | undefined>(undefined);
  const [error,setError]=useState("");
  const [services, setServices] = useState<Service[]>([]);

  useEffect(()=>{
    let live=true;
    setTenant(undefined);setServices([]);setError("");
    resolveTenant(repository,tenantSlug).then(async resolved=>{
      if(!live)return;
      if(!resolved){setTenant(null);return;}
      const items=await repository.listServices(resolved.id);
      if(!live)return;
      setTenant(resolved);setServices(items);
    }).catch(err=>{
      if(live){setError(err instanceof Error?err.message:"Falha ao carregar studio.");setTenant(null);}
    });
    return()=>{live=false;};
  },[tenantSlug]);

  useEffect(()=>{
    if(!tenant)return;
    const previous=document.title;
    document.title=`${tenant.name} | Agendamento`;
    return()=>{document.title=previous;};
  },[tenant?.id,tenant?.name]);
  if (tenant === undefined) return <section className="page" role="status">Carregando studio…</section>;
  if(error)return <section className="page" role="alert">{error}</section>;
  if (!tenant) return <section className="page"><h1>Tenant não encontrado</h1></section>;

  return (
    <TenantTheme tenant={tenant}>
      <section className="page tenant-page">
        {tenant.kind === "demo" && <div className="badge">DEMONSTRAÇÃO</div>}
        <div className="tenant-heading">
          <div className="logo-bubble">{tenant.branding.logoText}</div>
          <div>
            <h1>{tenant.name}</h1>
            <p>Escolha um serviço e marque um horário sem criar conta.</p>
          </div>
        </div>
        {services.length===0&&<p>Nenhum serviço ativo cadastrado no momento.</p>}
        <div className="row">
          {tenant.contact.whatsapp && <a className="button" target="_blank" rel="noopener noreferrer"
            href={`https://wa.me/${tenant.contact.whatsapp.replace(/\D/g,"")}`}>WhatsApp do studio</a>}
          {tenant.contact.instagram && <a className="button" target="_blank" rel="noopener noreferrer"
            href={`https://www.instagram.com/${encodeURIComponent(tenant.contact.instagram.replace(/^@/,""))}/`}>Instagram do studio</a>}
        </div>
        <div className="grid cards">
          {services.map((service) => (
            <article className="card" key={service.id}>
              <h3>{service.name}</h3>
              <p>{service.description}</p>
              <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.priceCents / 100)}</strong>
              <span>{service.durationMin} min</span>
            </article>
          ))}
        </div>
        <StudioPortfolio tenantId={tenant.id}/>
        <div className="row">
          {services.length>0&&<Link className="button primary" to={`/${tenant.slug}/book`}>Agendar agora</Link>}
          <Link className="button" to={`/customer/${tenant.slug}`}>Minha agenda</Link>
        </div>
      </section>
    </TenantTheme>
  );
}
