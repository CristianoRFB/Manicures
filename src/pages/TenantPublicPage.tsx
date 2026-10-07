import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { repository } from "../data/repository";
import type { Service, Tenant } from "../domain/types";
import { resolveTenant } from "../lib/tenantResolver";
import { TenantTheme } from "../components/TenantTheme";

export function TenantPublicPage() {
  const { tenantSlug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null | undefined>(undefined);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    resolveTenant(repository, tenantSlug).then(async (resolved) => {
      setTenant(resolved);
      if (resolved) setServices(await repository.listServices(resolved.id));
    });
  }, [tenantSlug]);

  if (tenant === undefined) return <section className="page">Carregando…</section>;
  if (!tenant) return <section className="page"><h1>Tenant não encontrado</h1></section>;

  return (
    <TenantTheme tenant={tenant}>
      <section className="page tenant-page">
        <div className="badge">DEMONSTRAÇÃO</div>
        <div className="tenant-heading">
          <div className="logo-bubble">{tenant.branding.logoText}</div>
          <div>
            <h1>{tenant.name}</h1>
            <p>Escolha um serviço e marque um horário sem criar conta.</p>
          </div>
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
        <Link className="button primary" to={`/${tenant.slug}/book`}>Agendar agora</Link>
      </section>
    </TenantTheme>
  );
}
