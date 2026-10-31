import { Link } from "react-router-dom";
import { demoModeEnabled } from "../lib/firebase";
export function HomePage() {
 const demo = demoModeEnabled();
 return <section className="hero page">
  <div className="badge">SAAS MANICURE</div><h1>Agendamento para profissionais de unhas</h1>
  <p>Agenda online por profissional, catálogo de procedimentos e experiência com identidade do seu studio.</p>
  <div className="actions">
   {demo && <Link className="button primary" to="/demo">Conhecer DEMO</Link>}
   <Link className="button" to="/pricing">Ver planos e preços</Link>
  </div>
  <p>{demo ? "Demo com dados fictícios. Ativação comercial manual; cobrança automática indisponível." : "Ativação comercial manual; cobrança automática indisponível."}</p>
 </section>;
}
