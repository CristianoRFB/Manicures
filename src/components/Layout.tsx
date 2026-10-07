import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">SaaS Manicure</Link>
        <nav>
          <Link to="/demo">Demo pública</Link>
          <Link to="/app/demo">Tenant Admin</Link>
          <Link to="/platform">Platform</Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer>Base CODEX-READY • DEMONSTRAÇÃO • sem cliente real associado</footer>
    </div>
  );
}
