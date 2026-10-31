import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { demoModeEnabled } from "../lib/firebase";

export function Layout({ children }: { children: ReactNode }) {
  const demo = demoModeEnabled();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
      <header className="topbar">
        <Link to="/" className="brand">SaaS Manicure</Link>
        <nav aria-label="Navegação principal">
          {demo ? <>
            <Link to="/demo">Demo pública</Link>
            <Link to="/app/demo">Tenant Admin</Link>
            <Link to="/professional/demo">Minha agenda</Link>
            <Link to="/customer/demo">Área do cliente</Link>
            <Link to="/platform">Platform</Link>
          </> : <>
            <Link to="/pricing">Planos</Link>
            <Link to="/platform">Plataforma</Link>
          </>}
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer>{demo ? "Base CODEX-READY • DEMONSTRAÇÃO • sem cliente real associado" : "SaaS Manicure • Agendamentos por studio"}</footer>
    </div>
  );
}
