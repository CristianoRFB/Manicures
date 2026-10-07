import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { repository } from "../data/repository";
import type { Appointment, Professional, Service, Tenant } from "../domain/types";
import { resolveTenant } from "../lib/tenantResolver";
import { useDemoSession } from "../auth/DemoSessionProvider";

export function TenantAdminPage() {
  const { tenantSlug } = useParams();
  const { session, loginAsTenantOwner, logout } = useDemoSession();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  useEffect(() => {
    resolveTenant(repository, tenantSlug).then(async (resolved) => {
      if (!resolved) return;
      setTenant(resolved);
      const [a, s, p] = await Promise.all([
        repository.listAppointments(resolved.id),
        repository.listServices(resolved.id),
        repository.listProfessionals(resolved.id),
      ]);
      setAppointments(a);
      setServices(s);
      setProfessionals(p);
    });
  }, [tenantSlug]);

  if (!tenant) return <section className="page">Tenant não encontrado.</section>;
  if (!session || session.role !== "tenant_owner" || session.tenantId !== tenant.id) {
    return <section className="page narrow"><div className="badge">DEMO AUTH SHELL</div><h1>Painel do tenant</h1><p>A base não usa credencial real. Entre com a sessão local de demonstração.</p><button className="button primary" onClick={loginAsTenantOwner}>Entrar como Tenant Owner Demo</button></section>;
  }

  return (
    <section className="page">
      <div className="row between"><div><div className="badge">TENANT ADMIN • DEMO</div><h1>{tenant.name}</h1></div><button className="button" onClick={logout}>Sair</button></div>
      <div className="stats">
        <div className="stat"><strong>{appointments.length}</strong><span>agendamentos</span></div>
        <div className="stat"><strong>{professionals.length}</strong><span>profissionais</span></div>
        <div className="stat"><strong>{services.length}</strong><span>serviços</span></div>
      </div>
      <h2>Agenda</h2>
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Horário</th><th>Status</th></tr></thead><tbody>
        {appointments.sort((a,b) => a.startsAt.localeCompare(b.startsAt)).map((a) => (
          <tr key={a.id}>
            <td>{a.customerName}</td>
            <td>{services.find((s) => s.id === a.serviceId)?.name ?? a.serviceId}</td>
            <td>{professionals.find((p) => p.id === a.professionalId)?.name ?? a.professionalId}</td>
            <td>{a.startsAt.replace("T", " ").slice(0,16)}</td>
            <td>{a.status}</td>
          </tr>
        ))}
      </tbody></table></div>
    </section>
  );
}
