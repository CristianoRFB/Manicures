# GLOBAL STANDARD v01 — Plans, Entitlements, Limits e Demo

**Status:** PADRÃO GLOBAL APROVADO POR CONSOLIDAÇÃO 9/9  
**Escopo:** contrato conceitual comum. Cada vertical continua com seu próprio repositório e implementação.

## 1. Princípio

O padrão global define:

- como representar plano;
- como resolver direito de uso;
- como aplicar limites;
- como representar status de assinatura;
- como operar demo;
- como aplicar exceções comerciais.

Ele NÃO define:
- preços globais;
- features globais;
- limites numéricos globais;
- banco físico idêntico entre todos os produtos.

## 2. Contrato lógico mínimo do tenant

Cada vertical deve conseguir representar conceitualmente:

```ts
type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled"
  | "demo";

type TenantCommercialState = {
  planId: string;
  subscriptionStatus: SubscriptionStatus;
  trialUntil?: string | null;

  entitlementOverrides?: Record<string, boolean>;
  limitOverrides?: Record<string, number | null>;
};
```

A forma física no Firestore/banco pode variar por vertical.

## 3. PlanCatalog

Cada vertical mantém seu próprio catálogo.

Contrato lógico:

```ts
type PlanDefinition = {
  id: string;
  name: string;
  rank: number;

  features: string[];
  limits: Record<string, number | null>;

  monthlyPriceCents?: number;
  annualPriceCents?: number;
  recommended?: boolean;
};
```

Semântica de limites:
- número positivo = teto;
- `0` = nenhuma unidade daquele recurso;
- `null` = sem teto comercial definido.

Não usar ausência/erro como forma implícita de “ilimitado”.

## 4. EntitlementService

Resolver direito de uso em um único ponto lógico:

```text
plano base
+ override do tenant
+ status da assinatura
= entitlement efetivo
```

API conceitual:

```ts
canUse(tenant, featureKey): boolean
getLimit(tenant, limitKey): number | null
```

Nunca espalhar lógica como:

```ts
if (tenant.slug === "cliente-x")
```

## 5. Feature Flag != Entitlement

**Entitlement** responde:

> O tenant contratou/tem direito?

**Feature/config flag** responde:

> O recurso está habilitado/configurado para esta operação?

Disponibilidade efetiva:

```text
entitlement permitido
AND
configuração habilitada
AND
recurso realmente implementado
```

Uma feature planejada não pode aparecer como disponível só porque o plano diz que ela existirá no futuro.

## 6. FeatureGating

Quando a feature afeta operação protegida:

```text
UI CHECK
+
BACKEND/SERVER CHECK
```

Esconder botão no frontend não é enforcement.

Aplicar backend validation em:
- escrita;
- operação financeira;
- automação;
- alteração administrativa;
- criação acima de limite;
- API/Worker/Function protegida.

## 7. Fundamentos que NÃO podem ser gated por plano

Nunca diferenciar plano por:

- isolamento de tenant;
- autenticação segura;
- Security Rules;
- integridade;
- correções de segurança;
- proteção básica de dados;
- tenant resolver seguro;
- RBAC básico necessário para o produto;
- confiabilidade essencial.

Segurança não é Premium.

## 8. Limits

Limites são específicos da vertical.

O padrão global exige:
- chave canônica;
- contagem confiável;
- enforcement no backend quando aplicável;
- mensagem clara no frontend;
- override auditável.

Exemplos de chaves locais:
- `professionals_active`
- `internal_users`
- `drivers_active`
- `units`
- `tables`
- `active_caravans`
- `catalog_items`

Não criar um catálogo global artificial de todas as chaves.

## 9. TenantOverrides

Overrides existem para exceções comerciais sem fork.

Podem:
- liberar/revogar feature;
- aumentar/reduzir limite.

Todo override relevante deve registrar, quando a vertical possuir audit log:
- ator;
- data;
- motivo;
- valor anterior;
- valor novo.

Overrides nunca podem enfraquecer fundamentos de segurança.

## 10. ManualPlanAssignment

Antes de billing automático, o `platform_owner` pode atribuir:

- `planId`;
- status;
- trial;
- overrides.

Isso permite vender e operar planos antes de implementar gateway.

## 11. DemoMode

Padrão global:

```text
subscriptionStatus = demo
planId = plano que a demo deve simular
```

Normalmente a demo simula Premium, mas a vertical decide.

Não depender de slug hardcoded.

Demo deve:
- identificar visualmente que é demonstração;
- usar dados fictícios quando necessário;
- liberar somente funções realmente implementadas;
- bloquear efeitos reais perigosos, como cobrança real, mensagens externas ou operações irreversíveis, quando aplicável.

## 12. Trial

O status `trial` existe globalmente, mas trial é opcional por vertical.

Cada vertical decide:
- se oferece;
- duração;
- plano simulado;
- necessidade de cartão.

Sem `trialUntil`, não inventar expiração.

## 13. Downgrade

Regra global:

- não apagar dados automaticamente;
- preservar histórico;
- se o tenant ficar acima do novo limite, bloquear nova criação quando necessário;
- manter leitura/exportação quando seguro;
- explicar necessidade de upgrade.

## 14. SubscriptionStatus

Estados canônicos:

```text
trial
active
past_due
suspended
cancelled
demo
```

Billing automático continua DEFERRED.

Enquanto não houver billing, `past_due` pode existir no contrato sem exigir automação financeira.

## 15. UsageMetering

Não é obrigatório no v01.

Usar apenas quando houver necessidade real:
- storage;
- mensagens;
- automações;
- recursos com custo variável;
- cobrança/limite baseado em consumo.

Promover para padrão obrigatório somente depois de casos reais suficientes.

## 16. Marketing / Landing

Default comercial global observado em 9/9:

```text
Essencial
Pro      ← recomendado
Premium
```

Isso é default, não obrigação absoluta.

A landing deve:
- destacar Pro;
- mostrar diferenças decisivas;
- não vender infraestrutura interna;
- não anunciar feature planejada como disponível;
- refletir o mesmo catálogo comercial aprovado da vertical.

## 17. Billing

Separar:

```text
Planos + Entitlements
```

de:

```text
Gateway + Checkout + Webhooks + Cobrança automática
```

O segundo não bloqueia o primeiro.

## 18. Testes mínimos quando o padrão for implementado

Criar tenants de teste:

- Essencial;
- Pro;
- Premium;
- Demo.

Testar:
- `canUse`;
- limits;
- overrides;
- downgrade;
- status;
- UI gating;
- backend gating;
- tenant A × tenant B;
- demo sem efeitos reais;
- segurança igual em todos os planos.

## 19. Regra de abstração

Não criar pacote compartilhado global agora.

Primeiro:
1. implementar o contrato em uma vertical piloto;
2. implementar em pelo menos outra vertical;
3. comparar a duplicação real;
4. só então decidir se vale extrair biblioteca compartilhada.

Isso evita abstração prematura entre codebases separados.
