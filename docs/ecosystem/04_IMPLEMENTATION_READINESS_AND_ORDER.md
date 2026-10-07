# Readiness e Ordem Recomendada de Implementação

## 1. Não existe “um GOAL global que altera os 9 repositórios”

Os codebases permanecem separados.

A consolidação global cria um **contrato padrão**.

Cada vertical recebe depois um GOAL específico para aplicar esse contrato ao repo real.

## 2. Primeira etapa — documentação global

Concluída neste pacote:

- padrão PlanCatalog;
- EntitlementService;
- FeatureGating;
- Limits;
- DemoMode;
- SubscriptionStatus;
- TenantOverrides;
- downgrade;
- manual plan assignment.

Nenhum runtime foi fingido como implementado.

## 3. Piloto recomendado — Manicure

Motivos:

- o handoff da vertical já coloca PlanCatalog/Entitlements/Limits/Gating em NOW;
- limites principais são simples: profissionais ativos e tenant admins;
- domínio é menor que Food/Sushi/Dentista;
- bom ambiente para validar:
  - `canUse()`;
  - `getLimit()`;
  - overrides;
  - downgrade;
  - demo;
  - subscription status;
  - frontend + backend gating.

Objetivo do piloto:
validar o **contrato**, não criar biblioteca universal imediatamente.

## 4. Gate de prontidão por vertical

Antes de implementar entitlements completos, a vertical deve possuir:

- tenant resolver confiável;
- isolamento Tenant A × Tenant B;
- memberships/RBAC;
- Security Rules/backend tenant-aware;
- Platform Owner;
- fonte de verdade do repo definida;
- feature states auditados;
- plano/feature matrix aprovada.

Se não passar esse gate, terminar o núcleo multi-tenant primeiro.

## 5. Estado por vertical

### Açaí
**Antes:** concluir migração multi-tenant/isolamento/Rules/memberships/tenant A+B.  
**Depois:** entitlements.

### Banca
**Antes:** remover BANCA_ID como source of truth, isolamento, memberships, jobs/cache tenant-aware.  
**Depois:** entitlements.

### Caravana
Planos aprovados e documentação pronta.  
Aplicar padrão quando o repo/runtime correspondente estiver pronto e auditado.

### Cosmaker
Base multi-tenant existe, mas ainda há acoplamento ao default atelier e rotas públicas por slug incompletas.  
Remover esses gaps antes de usar gating comercial amplo.

### Dentista
Prioridade é núcleo clínico/tenant/auth/Rules/agenda/prontuário/upload seguro.  
Entitlements entram depois; storage metering pode ser extensão futura.

### Food
Fonte técnica atual ainda precisa ser confirmada/materializada.  
Não implementar motor comercial em cima de estado técnico incerto.

### Manicure
**Melhor piloto atual.**

### Sorveteria
Core Essencial ainda precisa funcionar ponta a ponta:
auth/memberships, isolamento, catálogo, carrinho, checkout, pedido, tracking, delivery.  
Entitlements depois.

### Sushi
Primeiro concluir migração multi-tenant, Teiko como tenant, segundo tenant, Rules e hardening de checkout/reservas.  
Entitlements depois.

## 6. Sequência recomendada

```text
G0 — registrar Global Standard v01
G1 — Manicure como referência
G2 — revisar padrão após implementação real
G3 — aplicar nas verticais que passarem o readiness gate
G4 — somente depois avaliar biblioteca compartilhada
G5 — billing/gateway em projeto separado
```

## 7. O que NÃO fazer

- executar nove GOALs de pricing simultaneamente;
- criar nove implementações divergentes;
- criar pacote npm global antes de validar em código real;
- misturar billing automático com entitlement foundation;
- implementar pricing antes do núcleo multi-tenant seguro;
- reabrir os preços aprovados sem motivo comercial novo.
