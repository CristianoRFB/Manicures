# GLOBAL CONSOLIDATION HANDOFF

## PRODUCT
SaaS Manicure

## STATUS
READY_FOR_GLOBAL_CONSOLIDATION

## OPEN_DECISIONS
0

## APPROVED_PRICING

| Plano | Mensal | Anual | Status |
|---|---:|---:|---|
| Essencial | R$ 49,90 | R$ 499/ano | APROVADO |
| Pro | R$ 79,90 | R$ 799/ano | APROVADO |
| Premium | R$ 119,90 | R$ 1.199/ano | APROVADO |

Implantação/self-service: R$ 0.  
Onboarding assistido opcional: R$ 149.  
Trial: 14 dias sem cartão.

## RECOMMENDED_PLAN
**Pro**

Plano comercialmente destacado e recomendado.

## APPROVED_PLAN_SUMMARY

- **Essencial:** núcleo funcional completo para manicure autônoma, com 1 profissional.
- **Pro:** tudo do Essencial, até 3 profissionais e recursos de automação/gestão quando implementados.
- **Premium:** tudo do Pro, até 10 profissionais e módulos avançados quando implementados.
- **Add-ons:** nenhum add-on comercial ativo agora; profissional extra, WhatsApp oficial, domínio personalizado e migração complexa permanecem DEFERRED.

## APPROVED_LIMITS

| Limite | Essencial | Pro | Premium |
|---|---:|---:|---:|
| Profissionais ativos | 1 | 3 | 10 |
| Tenant admins adicionais | 0 | 2 | 5 |
| Unidades | 1 | 1 | 1 |
| Clientes | Sem limite comercial inicial | Sem limite comercial inicial | Sem limite comercial inicial |
| Serviços | Sem limite comercial inicial | Sem limite comercial inicial | Sem limite comercial inicial |
| Agendamentos | Sem limite comercial inicial | Sem limite comercial inicial | Sem limite comercial inicial |

Armazenamento: sem limite comercial divulgado inicialmente.  
Automações: sem quota numérica definida agora.

## GLOBAL_PATTERN_CANDIDATES

- `PlanCatalog` — CANDIDATO_A_PADRAO_GLOBAL
- `EntitlementService` — CANDIDATO_A_PADRAO_GLOBAL
- `FeatureGating` — CANDIDATO_A_PADRAO_GLOBAL
- `Limits` — CANDIDATO_A_PADRAO_GLOBAL
- `DemoMode` — CANDIDATO_A_PADRAO_GLOBAL
- `SubscriptionStatus` — CANDIDATO_A_PADRAO_GLOBAL
- `TenantOverrides` — CANDIDATO_A_PADRAO_GLOBAL

Nenhum item acima é considerado arquitetura global definida nesta etapa.

## VERTICAL_ONLY

- Taxonomia de serviços de manicure, pedicure, esmaltação, alongamento, manutenção, nail art e similares.
- Regras comerciais específicas de serviços de manicure quando dependerem da natureza do procedimento.
- Configuração de duração/preço por serviço de manicure.
- Regras locais de apresentação e branding específicas do nicho.

## SHARED_WITH_SOME_VERTICALS

- Agenda profissional.
- Disponibilidade por profissional.
- Pausas, folgas e bloqueios.
- Agendamento online.
- Cancelamento e remarcação.
- No-show.
- Lembretes de agendamento.
- Histórico de cliente associado a atendimentos.

Esses itens podem ser compartilhados com outras verticais baseadas em agendamento, mas NÃO são assumidos como padrão global.

## NOW

- Catálogo central de planos.
- `planId`.
- `subscriptionStatus`.
- `trialUntil`.
- Feature overrides.
- Limit overrides.
- EntitlementService.
- Limites `professionals_active` e `tenant_admins`.
- Feature gating.
- Backend validation.
- Audit log para plano/override.
- Downgrade sem apagar dados.
- Testes de planos + isolamento.
- Documentação canônica.

## NEXT

- Tenant demo real.
- Landing comercial.
- Pricing page.
- Trial operacional.
- Tela de plano no Platform Admin.
- Screenshots reais.
- Lembretes automáticos.
- Lista de espera.
- Relatórios básicos.
- Fidelidade.

## DEFERRED

- Gateway.
- Cobrança recorrente.
- Checkout.
- Webhooks financeiros.
- Dunning.
- WhatsApp oficial/API paga.
- Domínio personalizado.
- Add-on de profissional extra.
- Sinal/pagamento online.
- Pacotes.
- Comissões.
- Financeiro.
- Estoque.
- Relatórios avançados.
- CRM avançado.
- Múltiplas unidades.

## TECHNICAL_GAPS

- Catálogo de planos ainda não implementado.
- Entitlements e limits ainda não implementados.
- Feature gating ainda não implementado.
- Backend validation comercial ainda não implementada.
- Subscription status/trial ainda não implementados.
- Demo mode ainda não implementado.
- Landing/pricing ainda não implementadas.
- Testes de planos/overrides/downgrade ainda não existem.
- Regras específicas de limite por profissionais ativos ainda precisam ser implementadas.
- Documentação está consolidada; implementação permanece futura.

## ACTIVE_DELIVERABLE

- **Tipo:** ZIP + documentação.
- **Canônico da vertical:** `SAAS_MANICURE_GLOBAL_CONSOLIDATION.zip`
- **Handoff canônico:** `GLOBAL_CONSOLIDATION_HANDOFF.md`
- **Repo:** `CristianoRFB/Manicures` existe, mas não é a fonte ativa canônica desta etapa.
- **GOAL:** nenhum GOAL ativo para Codex nesta etapa.

## CODEX_STATUS
READY_FOR_VERTICAL_GOAL_LATER

Isso NÃO autoriza gerar ou enviar GOAL agora.

## GLOBAL_CONSOLIDATION_NOTES

- Todas as decisões comerciais desta vertical estão fechadas; `OPEN_DECISIONS=0`.
- Preços e anual estão aprovados e não devem ser reabertos na consolidação.
- Pro é o plano recomendado.
- O principal limitador comercial é número de profissionais ativos.
- Clientes, serviços e agendamentos não têm limite comercial inicial.
- Segurança, isolamento, integridade e prevenção de double booking não variam por plano.
- Demo deve simular Premium e liberar somente features realmente implementadas.
- Candidatos globais estão sinalizados, não definidos.
- Itens de agenda profissional pertencem a um grupo compartilhável entre algumas verticais, não necessariamente ao Core global.
- Nenhum código ou GOAL para Codex foi gerado nesta etapa.
