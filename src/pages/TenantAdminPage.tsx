import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { repository } from "../data/repository";
import type { Appointment, Membership, Professional, Service, Tenant } from "../domain/types";
import { resolveTenant } from "../lib/tenantResolver";
import { useAuth } from "../auth/AuthProvider";
import { LoginPanel } from "../components/LoginPanel";

const ADMIN_ROLES = new Set(["tenant_owner", "tenant_admin"]);

export function TenantAdminPage() {
  const { tenantSlug } = useParams();
  const { user, loading, logout } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [platformOwner, setPlatformOwner] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const auditLogged = useRef(false);

  useEffect(() => {
    resolveTenant(repository, tenantSlug).then(setTenant);
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenant || !user) {
      setMembership(null);
      setPlatformOwner(false);
      return;
    }
    Promise.all([
      repository.getMembership(tenant.id, user.uid).catch(() => null),
      repository.isPlatformOwner(user.uid).catch(() => false),
    ]).then(([nextMembership, isOwner]) => {
      setMembership(nextMembership);
      setPlatformOwner(isOwner);
    });
  }, [tenant, user]);

  const authorized = useMemo(() => platformOwner || Boolean(membership?.status === "active" && ADMIN_ROLES.has(membership.role)), [membership, platformOwner]);

  useEffect(() => {
    if (!tenant || !user || !authorized) return;
    Promise.all([
      repository.listAppointments(tenant.id), repository.listServices(tenant.id), repository.listProfessionals(tenant.id),
    ]).then(([a,s,p]) => { setAppointments(a); setServices(s); setProfessionals(p); });

    if (platformOwner && !auditLogged.current) {
      auditLogged.current = true;
      repository.recordAuditLog({
        id: crypto.randomUUID(), actorId: user.uid, actorRole: "platform_owner", tenantId: tenant.id,
        action: "platform.view_tenant", resourceType: "tenant", resourceId: tenant.id, createdAt: new Date().toISOString(),
      }).catch(() => undefined);
    }
  }, [tenant, user, authorized, platformOwner]);

  if (loading) return <section className="page">Validando sessão…</section>;
  if (!user) return <LoginPanel title="Painel do tenant" />;
  if (!tenant) return <section className="page">Tenant não encontrado ou suspenso.</section>;
  if (!authorized) return <section className="page narrow"><div className="badge">ACESSO NEGADO</div><h1>{tenant.name}</h1><p>Sua membership não autoriza administrar este tenant.</p><button className="button" onClick={() => void logout()}>Sair</button></section>;

  return (
    <section className="page">
      <div className="row between"><div><div className="badge">{platformOwner ? "PLATFORM OWNER" : membership?.role}</div><h1>{tenant.name}</h1></div><button className="button" onClick={() => void logout()}>Sair</button></div>
      <div className="stats">
        <div className="stat"><strong>{appointments.length}</strong><span>agendamentos</span></div>
        <div className="stat"><strong>{professionals.length}</strong><span>profissionais</span></div>
        <div className="stat"><strong>{services.length}</strong><span>serviços</span></div>
      </div>
      <h2>Agenda</h2>
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Horário</th><th>Status</th></tr></thead><tbody>
        {[...appointments].sort((a,b) => a.startsAt.localeCompare(b.startsAt)).map((a) => (
          <tr key={a.id}><td>{a.customerName}</td><td>{services.find((s) => s.id === a.serviceId)?.name ?? a.serviceId}</td><td>{professionals.find((p) => p.id === a.professionalId)?.name ?? a.professionalId}</td><td>{a.startsAt.replace("T", " ").slice(0,16)}</td><td>{a.status}</td></tr>
        ))}
      </tbody></table></div>
    </section>
  );
}
