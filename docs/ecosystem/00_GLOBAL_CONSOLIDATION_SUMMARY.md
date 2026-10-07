# SaaS Global Consolidation — 9/9 Verticais

**Status:** CONSOLIDAÇÃO GLOBAL CONCLUÍDA  
**Data:** 2026-10-06  
**Base:** handoffs canônicos aprovados de Açaí, Banca, Caravana, Cosmaker, Dentista, Food, Manicure, Sorveteria e Sushi.

## 1. Resultado principal

As nove verticais convergiram em um núcleo comercial/técnico comum suficientemente consistente para ser promovido de **CANDIDATO_A_PADRAO_GLOBAL** para **PADRÃO GLOBAL v01**, sem fundir os codebases.

Padrões globais confirmados:

- `PlanCatalog`
- `EntitlementService`
- `FeatureGating`
- `Limits`
- `DemoMode`
- `SubscriptionStatus`
- `TenantOverrides`
- atribuição manual de plano pelo `platform_owner` antes de billing automático
- downgrade preservando dados
- separação entre **entitlement comercial** e **feature/config flag**
- segurança, isolamento, autenticação e integridade nunca dependem de plano
- billing/gateway não é pré-requisito para planos/entitlements

## 2. O que continua local

Não existe preço global.

Cada vertical mantém:
- preços;
- desconto anual;
- trial;
- limites numéricos;
- features por plano;
- add-ons;
- regras de domínio;
- nomes específicos quando necessário.

O padrão global define **a mecânica**, não o conteúdo comercial.

## 3. Padrão comercial comum observado

As 9/9 verticais convergiram para:

- **Essencial**
- **Pro**
- **Premium**

e as 9/9 marcam **Pro como plano recomendado**.

Isso passa a ser o **default comercial global**, com liberdade para uma vertical renomear os rótulos quando houver motivo real.

## 4. Verticalização preservada

Permanece válida a regra do Core:

> MULTI-TENANT DENTRO DE CADA VERTICAL. INTEGRAÇÃO ENTRE VERTICAIS SOMENTE QUANDO NECESSÁRIO.

Não criar um monólito único para todos os SaaS.

## 5. Cluster VERTICAL confirmado — Alimentação

Afeta:
- Açaí
- Sorveteria
- Sushi
- Food

Padrões compartilháveis, sem obrigar codebase único:
- cardápio online;
- QR;
- retirada;
- delivery;
- contrato logístico compartilhável;
- caixa/financeiro operacional;
- KDS para quem realmente possui produção/cozinha;
- mesa/QR por mesa para quem realmente possui salão;
- motoboy/central de entregas para quem realmente usa entrega própria.

## 6. Cluster VERTICAL confirmado — Agendamento

Afeta:
- Dentista
- Manicure

Padrões compartilháveis:
- agenda por profissional;
- disponibilidade;
- bloqueios/folgas;
- agendamento público;
- cancelamento/remarcação;
- lembretes;
- prevenção de conflito;
- histórico associado a atendimento.

As regras clínicas do Dentista continuam locais.

## 7. Não promover para GLOBAL neste momento

- `UsageMetering` como motor obrigatório;
- marketplace;
- gateway/billing automático;
- domínio customizado automatizado;
- WhatsApp/API paga;
- fiscal;
- estoque genérico;
- shared delivery como serviço obrigatório;
- pacote de código compartilhado entre todos os repositórios.

`UsageMetering` fica como **extensão opcional** para verticais que tenham custos/limites que exijam medição real, como storage.

## 8. Próximo movimento

Não mandar os nove pacotes diretamente ao Codex.

Sequência correta:

1. registrar o padrão global v01;
2. usar uma vertical simples como implementação de referência;
3. validar contrato e testes;
4. aplicar o padrão em cada vertical somente quando o núcleo multi-tenant daquela vertical estiver pronto;
5. extrair biblioteca compartilhada apenas se a repetição real justificar.

A recomendação de piloto é **Manicure**, porque sua matriz já coloca PlanCatalog/Entitlements/Limits/Gating em NOW e os limites são relativamente simples.

## 9. Fontes consolidadas

- `ACAI_GLOBAL_CONSOLIDATION_CANONICAL.zip`
- `PACOTE_CANONICO_GLOBAL_CONSOLIDATION_SAAS_BANCA.zip`
- `caravana_global_canonical_2026-10-06.zip`
- `SAAS_COSMAKER_GLOBAL_CONSOLIDATION_READY.zip`
- `Dentista_GLOBAL_CONSOLIDATION_READY_v04.zip`
- `SAAS_FOOD_COMIDAS_GERAIS_GLOBAL_CONSOLIDATION_READY.zip`
- `SAAS_MANICURE_GLOBAL_CONSOLIDATION.zip`
- `SAAS_SORVETERIA_GLOBAL_CONSOLIDATION_READY_v05.zip`
- `SAAS_SUSHI_GLOBAL_CONSOLIDATION_CANONICAL.zip`
