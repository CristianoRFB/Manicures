# NEXT CODEX STEP

## Estado
O CORE multi-tenant atingiu:
`READY_FOR_GLOBAL_STANDARD_IMPLEMENTATION`

Evidência do código:
- SHA: `3667c1ef6137be80ebbd147c7a11f59cc33a3f8c`
- CI run: `40509207543`
- typecheck/tests/Worker/emulator/docs/build: PASS

## Próximo trabalho
Aplicar o **Global Standard v01 de planos/entitlements** em etapa separada, usando exatamente as decisões aprovadas da vertical.

Entram nessa próxima etapa:
- PlanCatalog local;
- planId / SubscriptionStatus;
- trialUntil aprovado;
- EntitlementService;
- canUse()/getLimit();
- FeatureGating frontend + backend;
- limites aprovados;
- TenantOverrides;
- ManualPlanAssignment;
- downgrade preservando dados;
- DemoMode;
- testes Essencial / Pro / Premium / Demo;
- regressão Tenant A × Tenant B.

## Não puxar
- billing automático;
- gateway/checkout/webhooks/dunning;
- marketplace;
- domínio custom automático;
- biblioteca global compartilhada;
- features NEXT/DEFERRED que não pertençam ao Global Standard.

## Evidência visual ainda pendente
Screenshots reais devem ser capturados quando houver ambiente browser/local/emulator interativo disponível. Não substituir por mockups. Os generated visuals continuam explicitamente conceituais.
