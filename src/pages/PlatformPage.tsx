import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { repository } from "../data/repository";
import type { Tenant } from "../domain/types";
import { useDemoSession } from "../auth/DemoSessionProvider";

export function PlatformPage() {
  const { session, loginAsPlatformOwner, logout } = useDemoSession();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  useEffect(() => { repository.listTenants().then(setTenants); }, []);

  if (!session || session.role !== "platform_owner") {
    return <section className="page narrow"><div className="badge">PLATFORM OWNER SHELL</div><h1>Administração da plataforma</h1><p>Sessão local de demonstração. Firebase Auth real será conectado no próximo GOAL.</p><button className="button primary" onClick={loginAsPlatformOwner}>Entrar como Platform Owner Demo</button></section>;
  }

  return <section className="page"><div className="row between"><div><div className="badge">PLATFORM OWNER • DEMO</div><h1>Tenants</h1></div><button className="button" onClick={logout}>Sair</button></div><div className="grid cards">
    {tenants.map((tenant) => <article className="card" key={tenant.id}><h3>{tenant.name}</h3><p>slug: /{tenant.slug}</p><p>status: {tenant.status}</p><Link to={`/app/${tenant.slug}`}>Abrir tenant</Link></article>)}
  </div></section>;
}
