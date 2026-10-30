import type {Tenant} from "../domain/types";
export type SubscriptionNotice={level:"ok"|"warning"|"blocked";message:string};
export function subscriptionNotice(tenant:Tenant,now=new Date()):SubscriptionNotice{
  if(tenant.status!=="active")return {level:"blocked",message:"Studio suspenso pela plataforma. Operações de agenda bloqueadas; dados preservados."};
  const commercial=tenant.commercial;
  if(!commercial?.subscriptionStatus)return {level:"warning",message:"Contrato legado sem plano atribuído. O Platform Owner deve regularizar, preservando os dados."};
  if(commercial.subscriptionStatus==="trial"){
    const until=commercial.trialUntil?Date.parse(commercial.trialUntil):NaN;
    if(!Number.isFinite(until)||until<=now.getTime())
      return {level:"blocked",message:"Período de teste encerrado. Novas operações controladas ficam bloqueadas até atribuição manual de estado válido; dados preservados."};
    const days=Math.ceil((until-now.getTime())/86400000);
    const date=new Date(until).toLocaleDateString("pt-BR",{timeZone:"UTC"});
    return days<=3?
      {level:"warning",message:`Teste termina em ${days} dia(s), em ${date}. Sem cobrança automática.`}:
      {level:"ok",message:`Período de teste ativo até ${date}, faltando ${days} dia(s). Sem cobrança automática.`};
  }
  if(commercial.subscriptionStatus==="active")return {level:"ok",message:"Assinatura ativa (atribuição manual). Segurança e dados permanecem protegidos em todos os planos."};
  if(commercial.subscriptionStatus==="demo")
    return {level:"ok",message:"Ambiente de demonstração fictício, sem cobrança."};
  if(commercial.subscriptionStatus==="past_due")
    return {level:"blocked",message:"Estado de pendência comercial: novas operações controladas ficam bloqueadas. Nenhuma cobrança é executada pelo sistema."};
  if(commercial.subscriptionStatus==="cancelled")
    return {level:"blocked",message:"Assinatura cancelada: dados preservados; novas operações controladas bloqueadas."};
  return {level:"blocked",message:"Assinatura suspensa: dados preservados; novas operações controladas bloqueadas."};
}
