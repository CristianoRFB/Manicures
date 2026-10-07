# DELTA_TECNICO

Status das decisões estruturais: **APROVADAS**

Comparação usada: **estado da auditoria anterior → mínimo necessário para planos reais**.

Somente o que falta:

## Catálogo de planos
- catálogo central `essential / pro / premium`;
- features e limits por plano;
- nenhum `if tenantId == cliente`.

## Subscription state
Adicionar ao tenant:

- `planId`;
- `subscriptionStatus`;
- `trialUntil`;
- `entitlementOverrides`;
- `limitOverrides`;
- `subscriptionUpdatedAt`.

Estados mínimos:

- `trial`;
- `active`;
- `past_due`;
- `suspended`;
- `cancelled`;
- `demo`.

## Entitlements
Serviço central:

- `getEffectiveEntitlements(tenantId)`;
- `canUse(tenantId, featureKey)`;
- `getLimit(tenantId, limitKey)`;
- `assertCanUse(...)`;
- `assertWithinLimit(...)`.

## Feature gating
- gate de UI;
- gate equivalente na camada confiável;
- nunca usar apenas botão oculto.

## Limits
NOW:

- `professionals_active`;
- `tenant_admins`.

Não adicionar limite de clientes, serviços ou agendamentos agora.

## Backend validation
Revalidar pelo menos:

- criação/reativação de profissional;
- operações dependentes de feature;
- overrides;
- mudança de plano;
- tenant suspenso.

## Demo mode
Definir o estado `demo` e `premium_demo` no contrato.

**A criação do tenant demo real é NEXT**, não NOW.

## Landing / pricing
Ainda falta:

- landing;
- pricing page;
- comparação;
- FAQ;
- CTA/trial;
- screenshots reais.

Tudo isso é **NEXT**.

## Testes
Criar testes para:

- Essencial;
- Pro;
- Premium;
- demo;
- limites;
- overrides;
- upgrade;
- downgrade;
- tenant suspenso;
- Tenant A × Tenant B;
- UI gate × backend gate.

## Documentação
Manter como fonte:

- feature matrix;
- pricing;
- entitlement contract;
- prioridade NOW/NEXT/DEFERRED;
- decisões.

## Específico da vertical
- limite de profissionais precisa considerar somente profissionais **ativos**;
- downgrade não apaga profissionais excedentes;
- downgrade bloqueia nova criação/reativação até voltar ao limite;
- agenda e histórico permanecem preservados;
- lembretes não entram em NOW só por existirem no plano Pro;
- prevenção de double booking nunca depende do plano.

## Não falta agora
Não adicionar ao delta NOW:

- gateway;
- checkout;
- webhooks de cobrança;
- dunning;
- WhatsApp oficial;
- financeiro;
- estoque;
- CRM.
