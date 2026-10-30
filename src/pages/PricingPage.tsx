import { Link } from "react-router-dom";
import { IMPLEMENTED_FEATURES, PLAN_CATALOG, PLAN_ORDER } from "../commercial/planCatalog";
const brl=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value/100);
export function PricingPage() {
 return <section className="page">
  <div className="badge">PLANOS APROVADOS — MANICURE</div>
  <h1>Planos para cada tamanho de studio</h1>
  <p>Agendamento, segurança e proteção dos dados fazem parte da base — não são extras pagos. A contratação e ativação são manuais nesta fase.</p>
  <div className="grid cards">
    {PLAN_ORDER.map(id=>{
      const plan=PLAN_CATALOG[id];
      return <article className="card" key={id}>
        {plan.recommended && <strong>Recomendado</strong>}
        <h2>{plan.name}</h2>
        <p><strong>{brl(plan.monthlyPriceCents)}/mês</strong></p>
        <p>ou {brl(plan.annualPriceCents)}/ano</p>
        <p>{plan.limits.professionals_active} profissional(is) ativo(s)</p>
        <p>{plan.limits.tenant_admins} admin(s) adicional(is)</p>
        <p>Agendamento e página pública: disponíveis na base.</p>
        <p>{plan.features.filter(f=>!IMPLEMENTED_FEATURES.has(f)).length} capacidades do plano ainda em desenvolvimento; não estão habilitadas.</p>
      </article>;
    })}
  </div>
  <p>Trial aprovado de 14 dias sem cartão, mediante ativação manual; cobrança automática e integração de pagamento ainda não estão disponíveis.</p>
  <Link to="/demo">Conhecer demonstração</Link>
 </section>;
}
