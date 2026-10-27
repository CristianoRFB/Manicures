import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { repository } from "../data/repository";
import type { Tenant } from "../domain/types";
import { useAuth } from "../auth/AuthProvider";
import { LoginPanel } from "../components/LoginPanel";

export function PlatformPage() {
  const { user, loading, logout } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    if (!user) { setAuthorized(null); setTenants([]); return; }
    repository.isPlatformOwner(user.uid).then(async (ok) => {
      setAuthorized(ok);
      if (ok) setTenants(await repository.listTenants());
    }).catch(() => setAuthorized(false));
  }, [user]);

  if (loading) return <section className="page">Validando sessão…</section>;
  if (!user) return <LoginPanel title="Administração da plataforma" />;
  if (authorized === null) return <section className="page">Validando Platform Owner…</section>;
  if (!authorized) return <section className="page narrow"><div className="badge">ACESSO NEGADO</div><h1>Administração da plataforma</h1><p>O usuário autenticado não é Platform Owner.</p><button className="button" onClick={() => void logout()}>Sair</button></section>;

  return <section className="page"><div className="row between"><div><div className="badge">PLATFORM OWNER</div><h1>Tenants</h1></div><button className="button" onClick={() => void logout()}>Sair</button></div><div className="grid cards">
    {tenants.map((tenant) => <article className="card" key={tenant.id}><h3>{tenant.name}</h3><p>slug: /{tenant.slug}</p><p>status: {tenant.status}</p><Link to={`/app/${tenant.slug}`}>Abrir tenant</Link></article>)}
  </div></section>;
}
