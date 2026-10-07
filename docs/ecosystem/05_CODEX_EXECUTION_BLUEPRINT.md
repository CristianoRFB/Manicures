# Blueprint para a próxima fase com Codex

Este arquivo NÃO é um GOAL executável. É o plano para gerar GOALs seguros.

## GOAL 0 — Core documental

Objetivo:
registrar no repositório/documentação central do ecossistema o `GLOBAL STANDARD v01`.

Não altera runtimes dos produtos.

Entregáveis:
- referência ao padrão global;
- versão;
- decisão GLOBAL / VERTICAL / LOCAL;
- registro de que preços/limites permanecem por vertical.

## GOAL 1 — Referência de Entitlements na Manicure

Somente depois de auditar o repo atual da Manicure.

Escopo:

- PlanCatalog local da Manicure;
- `planId`;
- `subscriptionStatus`;
- `trialUntil`;
- `entitlementOverrides`;
- `limitOverrides`;
- EntitlementService;
- `canUse`;
- `getLimit`;
- limites:
  - professionals_active;
  - tenant_admins;
- feature gating UI;
- backend validation;
- atribuição manual de plano pelo Platform Owner;
- audit log de mudança de plano/override;
- downgrade preservando dados;
- DemoMode;
- testes Essencial/Pro/Premium/Demo;
- Tenant A × Tenant B.

Não incluir:
- gateway;
- checkout;
- webhooks;
- cobrança recorrente;
- WhatsApp pago;
- multi-unidade;
- features deferred.

## GOAL 2 — Pós-piloto

Antes de copiar para outra vertical:

1. revisar bugs;
2. comparar contrato com Global Standard;
3. registrar ADRs;
4. corrigir o padrão global somente se a implementação real revelar necessidade;
5. decidir se há código realmente reutilizável.

## GOALs verticais seguintes

Gerar SOMENTE quando cada repo passar o readiness gate.

Cada GOAL deve:
- ler o Core;
- ler Global Standard v01;
- ler o pacote canônico da própria vertical;
- auditar o repo real;
- preservar NOW/NEXT/DEFERRED;
- implementar somente o que estiver autorizado;
- nunca copiar limite/preço de outra vertical.

## Shared package

NÃO criar agora.

Só avaliar algo como um pacote compartilhado após pelo menos duas implementações reais mostrarem interfaces e código essencialmente idênticos.

Mesmo assim, o pacote deve conter infraestrutura genérica, não regras comerciais locais.

## Billing

Criar uma iniciativa separada depois que:
- planos funcionarem manualmente;
- entitlements estiverem estáveis;
- upgrade/downgrade manual estiver testado;
- demanda real justificar automação.

Fluxo:

```text
manual plan assignment
→ planos validados com clientes
→ entitlement estável
→ billing/gateway
```
