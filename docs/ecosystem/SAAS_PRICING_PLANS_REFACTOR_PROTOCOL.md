# SAAS — Protocolo Global de Planos, Pricing, Entitlements e Refatoração de Entregáveis

> **Status:** PROPOSTA GLOBAL PARA ADOÇÃO  
> **Escopo:** todos os SaaS do Project `SaaS` em que venda por assinatura fizer sentido  
> **Função:** padronizar como cada chat especialista deve auditar o produto, distribuir funcionalidades entre planos, propor preços, preparar demo comercial e refatorar ZIPs/GOALs/documentação sem inventar estado de implementação.

---

## 1. Por que este arquivo existe

O ecossistema SaaS já possui vários produtos em estágios diferentes.

Exemplos:

- SaaS Açaí;
- SaaS Sorveteria;
- SaaS Sushi;
- SaaS Food;
- SaaS Dentista;
- SaaS Manicure;
- SaaS Banca;
- SaaS Caravana;
- SaaS Cosmaker;
- outros futuros.

Cada produto possui funcionalidades, maturidade, público, ticket e regras de negócio diferentes.

Não é correto simplesmente copiar os mesmos três planos e os mesmos preços para todos.

Ao mesmo tempo, não faz sentido cada chat inventar do zero como estruturar:

- planos;
- pricing;
- limites;
- entitlement;
- demo;
- landing comercial;
- feature gating;
- trial;
- upgrade;
- downgrade.

Este documento cria um **protocolo único de análise e refatoração**.

---

# 2. Resultado esperado

Depois que um chat especialista aplicar este protocolo, ele deve possuir uma resposta clara para:

```text
O que o produto faz hoje?
↓
Quais funções realmente existem?
↓
Quais ainda estão planejadas?
↓
Quais funções pertencem a cada plano?
↓
Quais limites mudam por plano?
↓
Quanto cada plano deve custar?
↓
Como a demo deve funcionar?
↓
Como o código controla acesso?
↓
Como a landing apresenta os planos?
↓
O que precisa mudar no GOAL / ZIP / repo / docs?
```

---

# 3. Regra fundamental

## NÃO DISTRIBUIR FEATURES ENTRE PLANOS ANTES DE AUDITAR O PRODUTO

O chat especialista deve primeiro descobrir o estado real.

Fontes de verdade, em ordem de preferência:

1. repositório atual;
2. documentação atual do produto;
3. GOAL vigente;
4. ZIP vigente;
5. contexto consolidado do chat;
6. screenshots e evidências reais.

Não assumir que uma função está implementada apenas porque foi discutida.

Toda feature deve receber um estado:

```text
IMPLEMENTADA
EM_IMPLEMENTACAO
PLANEJADA
DEFERRED
LEGACY
DESCARTADA
NAO_CONFIRMADA
```

Só depois fazer pricing.

---

# 4. Fase 1 — Auditoria funcional

Cada chat especialista deve criar um inventário do produto.

Formato recomendado:

| Módulo | Feature | Estado | Valor para cliente | Custo/complexidade | Dependências |
|---|---|---|---|---|---|
| Pedidos | Criar pedido | IMPLEMENTADA | Alto | Médio | Auth |
| Financeiro | Relatório mensal | IMPLEMENTADA | Alto | Médio | Pedidos |
| Delivery | Motoboy | PLANEJADA | Alto | Alto | Delivery Core |

A auditoria deve separar:

- infraestrutura;
- operação central;
- administração;
- recursos comerciais;
- automações;
- relatórios;
- integrações;
- white-label;
- limites quantitativos;
- recursos premium;
- funções internas da plataforma.

---

# 5. Fase 2 — Classificação comercial de cada feature

Depois da auditoria, cada feature deve ser classificada comercialmente.

Categorias:

## CORE

Função sem a qual o produto não resolve seu problema principal.

Normalmente pertence ao plano de entrada.

Exemplo:

```text
Dentista → agenda básica
Sushi → cardápio + pedidos
Açaí → montagem/pedido
Manicure → agenda
Caravana → cadastro de participantes
```

## GROWTH

Função que melhora operação, produtividade ou profissionalização.

Normalmente pertence ao plano intermediário.

Exemplos:

- relatórios;
- automações;
- delivery;
- QR por mesa;
- lembretes;
- financeiro mais completo;
- módulos operacionais adicionais.

## ADVANCED

Função de maior valor, automação, escala ou gestão.

Normalmente pertence ao plano superior.

Exemplos:

- relatórios avançados;
- múltiplas unidades;
- automações avançadas;
- permissões avançadas;
- integrações premium;
- personalizações adicionais;
- maior volume/limites.

## ADD-ON

Função que não deve obrigatoriamente fazer parte do aumento de plano.

Pode ser vendida separadamente.

Exemplos possíveis:

- unidade extra;
- WhatsApp/API paga;
- domínio personalizado premium;
- implantação especial;
- migração complexa;
- módulo opcional de nicho.

## PLATFORM_INTERNAL

Não é uma feature vendável.

Exemplos:

- Platform Owner;
- audit log interno;
- ferramentas de suporte;
- gestão global;
- observabilidade;
- mecanismos de segurança.

Não colocar isso em tabela de marketing apenas para “encher plano”.

---

# 6. Arquitetura padrão dos planos

O padrão inicial recomendado é:

```text
PLANO 1 — ESSENCIAL / STARTER / BÁSICO
PLANO 2 — PRO / CRESCIMENTO
PLANO 3 — PREMIUM / BUSINESS / COMPLETO
```

Os nomes podem mudar de acordo com a vertical.

O número de planos também pode mudar se houver justificativa.

Não forçar três planos quando o negócio claramente pede outra estrutura.

Entretanto, **três opções é o padrão comercial inicial** porque facilita comparação e ancoragem de preço.

---

# 7. Regra de composição

## Plano de entrada

Deve resolver o problema principal de verdade.

Não pode ser deliberadamente inútil.

Objetivo:

```text
baixo atrito de entrada
+
produto utilizável
+
motivo real para fazer upgrade depois
```

## Plano intermediário

Deve ser a opção com melhor equilíbrio entre valor e preço.

Normalmente será apresentado como:

```text
MAIS ESCOLHIDO
ou
RECOMENDADO
```

Ele deve concentrar as funcionalidades que a maior parte do público-alvo realmente deseja.

## Plano superior

Deve mostrar o potencial máximo do produto.

Objetivo:

- clientes maiores;
- operações mais complexas;
- ancoragem de valor;
- ticket superior;
- funções avançadas.

---

# 8. Herança entre planos

Preferir:

```text
PRO = tudo do ESSENCIAL + ...
PREMIUM = tudo do PRO + ...
```

Evitar tabelas onde o cliente precisa conferir dezenas de combinações arbitrárias.

A comparação precisa ser compreensível rapidamente.

---

# 9. Features versus limites

Nem toda diferença de plano precisa ser uma feature nova.

Planos também podem mudar por limite.

Exemplos:

```text
número de usuários
número de unidades
número de mesas
número de profissionais
número de pedidos/mês
número de clientes
número de campanhas
número de relatórios
armazenamento
histórico disponível
automações mensais
```

O chat deve distinguir:

```text
FEATURE ENTITLEMENT
```

de:

```text
USAGE LIMIT
```

---

# 10. Pricing — como estimar

Cada chat especialista deve propor preço próprio para sua vertical.

NÃO existe um preço global obrigatório para todos os SaaS.

A estimativa deve considerar:

- valor econômico para o cliente;
- tempo economizado;
- redução de trabalho manual;
- porte típico do negócio;
- responsabilidade operacional;
- quantidade de módulos;
- complexidade de suporte;
- concorrentes conhecidos;
- mercado brasileiro;
- ticket mensal tolerável para aquele nicho;
- custos variáveis reais da plataforma;
- margem necessária;
- posicionamento desejado.

Quando houver pesquisa recente de concorrentes, separar claramente:

```text
PREÇO OBSERVADO NO MERCADO
```

de:

```text
PREÇO PROPOSTO PARA NOSSO PRODUTO
```

---

# 11. Saída mínima de pricing

Cada especialista deve gerar:

| Plano | Preço mensal sugerido | Público | Motivo |
|---|---:|---|---|
| Essencial | R$ ... | operação pequena | entrada |
| Pro | R$ ... | maioria dos clientes | melhor custo-benefício |
| Premium | R$ ... | operação avançada | máximo valor |

Também deve avaliar:

- preço anual;
- desconto anual;
- implantação;
- trial;
- add-ons;
- taxa de migração, se aplicável.

Nada disso deve ser inventado como “já aprovado”.

Marcar claramente:

```text
PROPOSTA
VALIDADO
EM_TESTE
```

---

# 12. Entitlements no código

Planos não podem existir apenas visualmente.

Deve haver uma camada real de autorização de features.

Modelo conceitual:

```text
tenant
├── planId
├── subscriptionStatus
├── trialUntil
├── limits
└── entitlementOverrides
```

Catálogo:

```text
plan
├── id
├── name
├── features[]
└── limits{}
```

Exemplo conceitual:

```text
canUse(tenant, "delivery")
canUse(tenant, "advanced_reports")
getLimit(tenant, "users")
```

---

# 13. Segurança do feature gating

Esconder botão no frontend NÃO é controle de plano.

Quando uma feature restrita afeta:

- escrita no banco;
- operação financeira;
- dados protegidos;
- automação;
- limites;
- endpoints;
- Cloud Functions;
- Workers;
- APIs;

o backend também deve validar entitlement.

Regra:

```text
UI CHECK
+
SERVER/BACKEND CHECK
```

---

# 14. Overrides

O produto deve permitir exceções comerciais sem criar fork de código.

Exemplos:

```text
cliente antigo ganha feature X
parceiro recebe limite adicional
demo tem tudo liberado
contrato personalizado
beta tester
```

Modelo conceitual:

```text
basePlan
+
tenant entitlement overrides
```

Nunca:

```text
if tenant == "clienteXYZ"
```

espalhado pelo código.

---

# 15. Demo comercial

A demo usada para prospecção deve, em regra, mostrar o potencial máximo do produto.

Padrão:

```text
DEMO TENANT
plan = PREMIUM_DEMO
subscriptionStatus = demo
```

Ela pode exibir:

```text
Demonstração — Plano Premium
```

O objetivo é permitir que o prospect veja o produto completo.

A landing/tela de pricing explica quais recursos ficam disponíveis em cada plano real.

---

# 16. Demo personalizada por lead

Quando existir `LEAD_CONTEXT.md` vindo de pesquisa/Work:

```text
LEAD_CONTEXT
↓
DEMO TENANT
↓
branding
↓
dados demonstrativos
↓
features premium
↓
URL de demonstração
```

Não criar código exclusivo do lead.

Configurar tenant.

Exemplo conceitual:

```text
tenantSlug
brandName
logo
colors
sampleData
plan = premium-demo
```

---

# 17. Landing pública do SaaS

Todo SaaS comercializável deve avaliar uma landing própria.

Estrutura inicial:

```text
Hero
↓
Problema
↓
Benefícios
↓
Demonstração / screenshots
↓
Funcionalidades
↓
Planos
↓
Comparação
↓
FAQ
↓
CTA
```

A landing deve diferenciar:

```text
produto
```

de:

```text
tenant do cliente
```

Ela vende o SaaS.

O tenant usa o SaaS.

---

# 18. Pricing na landing

A tabela precisa ser legível.

Evitar 40 linhas de features irrelevantes.

Destacar:

- diferenças decisivas;
- limites relevantes;
- plano recomendado;
- CTA;
- preço mensal;
- opção anual quando existir.

Detalhes extensos podem ficar em:

```text
Comparar todos os recursos
```

---

# 19. Fluxo comercial global

```text
WORK / PESQUISA
       ↓
LEAD
       ↓
QUALIFICAÇÃO
       ↓
LEAD_CONTEXT.md
       ↓
DEMO TENANT
       ↓
LANDING + PRICING
       ↓
PROSPECÇÃO
       ↓
ESCOLHA DO PLANO
       ↓
ONBOARDING
       ↓
TENANT REAL
```

---

# 20. O que cada chat especialista deve fazer agora

Cada chat deve executar este protocolo contra seu produto.

## ETAPA A — AUDITAR

Ler o estado atual e produzir:

```text
FEATURE_INVENTORY.md
```

ou seção equivalente.

Não alterar o produto ainda.

## ETAPA B — PROPOR PLANOS

Criar:

```text
PRICING_AND_PLANS.md
```

com:

- planos;
- preços estimados;
- features;
- limites;
- add-ons;
- público;
- justificativa;
- status de cada decisão.

## ETAPA C — DELTA TÉCNICO

Identificar o que falta para suportar planos de verdade:

```text
entitlements
feature gates
limits
subscription state
demo mode
landing
pricing page
backend validation
tests
docs
```

## ETAPA D — REFATORAR O ENTREGÁVEL ATUAL

O especialista deve descobrir qual é o artefato ativo.

### Caso exista GOAL ainda não executado

Refatorar o GOAL para incorporar apenas o que pertence ao escopo atual.

Não inflar uma migração crítica com features comerciais que podem esperar.

Registrar o restante como NEXT/DEFERRED.

### Caso exista ZIP sendo usado como base

Refatorar o ZIP/documentação de especificação para incluir:

- arquitetura de planos;
- matriz de features;
- proposta de pricing;
- landing/pricing quando aplicável;
- feature gating;
- demo;
- roadmap.

Não fingir que código inexistente foi implementado.

### Caso o GitHub seja a fonte atual

Preferir:

```text
repo atual
+
docs versionadas
+
GOAL específico
```

em vez de reconstruir ZIP antigo sem necessidade.

---

# 21. Regra anti-explosão de escopo

A descoberta deste protocolo NÃO significa:

```text
todos os SaaS precisam implementar tudo hoje
```

O especialista deve classificar cada mudança:

```text
NOW
NEXT
DEFERRED
```

Exemplo:

Se o produto está no meio de migração Multi-Tenant:

```text
NOW
- isolamento
- tenant resolver
- RBAC
- Security Rules
- migração

NEXT
- plan catalog
- entitlement service
- landing pricing

DEFERRED
- cobrança automática
- integração com gateway
```

Não destruir um GOAL bom transformando-o em um monstro.

---

# 22. Critérios para distribuir features entre planos

Cada feature deve responder:

### 1. É essencial para o problema principal?

Se sim, tende ao plano de entrada.

### 2. Aumenta produtividade ou receita?

Tende ao intermediário.

### 3. É importante principalmente para operação maior/avançada?

Tende ao Premium.

### 4. Gera custo variável relevante?

Pode precisar de limite ou add-on.

### 5. É infraestrutura/segurança?

Não vender artificialmente como vantagem de plano.

Exemplo:

```text
segurança de isolamento de tenant
```

não deve ser:

```text
"disponível apenas no Premium"
```

Segurança básica é obrigação do produto.

---

# 23. O que NÃO limitar por plano

Não restringir fundamentos como estratégia comercial.

Exemplos:

- isolamento de dados;
- segurança básica;
- integridade;
- backup essencial quando necessário;
- correções de bug;
- LGPD mínima;
- autenticação segura.

Planos diferenciam valor funcional, escala e serviço.

Não diferenciam produto seguro versus produto inseguro.

---

# 24. Matriz obrigatória por produto

Cada SaaS deve terminar com algo semelhante:

| Feature | Estado | Essencial | Pro | Premium | Add-on | Observação |
|---|---|---:|---:|---:|---:|---|
| Feature A | IMPLEMENTADA | ✅ | ✅ | ✅ | ❌ | core |
| Feature B | IMPLEMENTADA | ❌ | ✅ | ✅ | ❌ | growth |
| Feature C | PLANEJADA | ❌ | ❌ | ✅ | ❌ | NEXT |
| Feature D | IMPLEMENTADA | ❌ | ❌ | ❌ | ✅ | custo variável |

IMPORTANTE:

Uma feature `PLANEJADA` pode constar na estratégia futura, mas não deve aparecer na landing pública como disponível hoje sem identificação clara.

---

# 25. Matriz de limites

Exemplo:

| Limite | Essencial | Pro | Premium |
|---|---:|---:|---:|
| usuários | 2 | 5 | 15 |
| unidades | 1 | 1 | 3 |
| histórico | 3 meses | 12 meses | completo |

Os números devem ser definidos pelo especialista da vertical.

Não copiar números deste exemplo automaticamente.

---

# 26. Testes obrigatórios

Quando planos forem implementados:

```text
tenant Basic
tenant Pro
tenant Premium
tenant Demo
```

Testar:

- UI;
- rotas;
- backend;
- API;
- limites;
- upgrade;
- downgrade;
- override;
- tenant isolation.

Exemplos:

```text
Basic não executa endpoint Premium.
Premium executa.
Demo executa.
Tenant A não afeta Tenant B.
```

---

# 27. Downgrade

O especialista deve pensar no que acontece quando o cliente perde uma feature.

Exemplo:

```text
Premium → Basic
```

Não apagar dados automaticamente.

Preferir:

- preservar dados;
- impedir nova criação quando acima do limite;
- permitir leitura quando apropriado;
- explicar necessidade de upgrade.

Cada vertical deve documentar comportamento.

---

# 28. Cancelamento

Planos também precisam de estado de assinatura.

Exemplo:

```text
trial
active
past_due
suspended
cancelled
demo
```

A implementação pode ser posterior.

Mas a arquitetura não deve depender apenas de:

```text
planId
```

---

# 29. Cobrança

Pricing/entitlements e gateway de pagamento são problemas relacionados, mas diferentes.

Primeiro pode existir:

```text
plano definido manualmente pelo Platform Owner
```

Depois:

```text
checkout
assinatura
webhooks
cobrança automática
```

Não bloquear a implantação de planos porque ainda não existe gateway.

---

# 30. Saída obrigatória do especialista

Ao terminar a análise, o chat deve entregar:

## A. Estado atual

```text
o que existe
o que não existe
o que não foi possível confirmar
```

## B. Planos propostos

```text
nome
preço
público
features
limites
```

## C. Justificativa

Por que cada feature está naquele plano.

## D. Delta técnico

O que o código precisa para suportar a estratégia.

## E. Prioridade

```text
NOW
NEXT
DEFERRED
```

## F. Entregável refatorado

Conforme o estado real:

```text
GOAL atualizado
ou
ZIP atualizado
ou
docs/repo atualizados
```

---

# 31. Prompt curto para acionar este protocolo em um chat especialista

Quando este MD estiver disponível nas fontes do Project, o usuário pode dizer:

```text
Aplique o protocolo global de planos/pricing neste SaaS.

Audite primeiro o estado real do produto e das funcionalidades.
Depois:
1. inventarie todas as features;
2. classifique o estado de cada uma;
3. proponha os planos e preços desta vertical;
4. distribua features e limites;
5. defina demo e landing comercial;
6. identifique o delta técnico de entitlements;
7. classifique mudanças em NOW/NEXT/DEFERRED;
8. refatore o entregável ativo (GOAL, ZIP ou docs/repo) sem fingir implementação.

Não copie preços ou features de outro SaaS sem justificativa.
```

---

# 32. Fluxo entre chats

```text
SAAS CORE
   ↓
este protocolo global
   ↓
CHAT ESPECIALISTA — Açaí
CHAT ESPECIALISTA — Sushi
CHAT ESPECIALISTA — Dentista
CHAT ESPECIALISTA — Manicure
CHAT ESPECIALISTA — ...
   ↓
auditoria individual
   ↓
planos próprios
   ↓
pricing próprio
   ↓
delta técnico
   ↓
entregável refatorado
   ↓
CODEX
```

---

# 33. O que volta ao Core

Depois que cada vertical fizer sua análise, promover para o Core somente padrões realmente compartilháveis.

Exemplos:

```text
estrutura de entitlement
status de assinatura
modelo demo
padrão de pricing page
padrão de feature gate
regras de segurança
```

Não promover como global:

```text
preço específico do Dentista
feature específica do Sushi
limite específico do Açaí
```

---

# 34. Regra final

Este protocolo não existe para transformar todo SaaS em uma tabela artificial de preços.

Ele existe para responder de forma disciplinada:

> **o que estamos vendendo, para quem, por quanto e quais capacidades esse cliente realmente recebe?**

E garantir que:

```text
marketing
=
produto
=
entitlement
=
backend
=
documentação
```

sem divergência.

