import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <section className="hero page">
      <div className="badge">BASE TÉCNICA • CORE FIRST</div>
      <h1>SaaS Manicure</h1>
      <p>Base executável para evoluir no Codex sem inventar cliente real ou pular o núcleo multi-tenant.</p>
      <div className="actions">
        <Link className="button primary" to="/demo">Abrir tenant DEMO</Link>
        <Link className="button" to="/app/demo">Abrir painel DEMO</Link>
      </div>
      <div className="callout">
        Pricing aprovado existe na documentação, mas gating comercial completo não foi implementado nesta base.
      </div>
    </section>
  );
}
