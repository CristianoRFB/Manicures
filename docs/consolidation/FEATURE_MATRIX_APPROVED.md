# FEATURE_MATRIX_APPROVED

| Funcionalidade | Estado real | Plano | Limite |
|---|---|---|---|
| Multi-Tenant | PLANEJADA | Interna | — |
| White-Label por tenant | PLANEJADA | Essencial | — |
| Platform Owner | PLANEJADA | Interna | — |
| Memberships | PLANEJADA | Interna | — |
| RBAC | PLANEJADA | Interna | — |
| Tenant resolver por slug | PLANEJADA | Interna | — |
| Audit logs | PLANEJADA | Interna | — |
| Security Rules / isolamento | PLANEJADA | Interna | — |
| Onboarding de tenant | PLANEJADA | Interna | — |
| Cadastro de serviços | PLANEJADA | Essencial | Sem limite comercial inicial |
| Preço e duração por serviço | PLANEJADA | Essencial | Sem limite comercial inicial |
| Cadastro de profissionais | PLANEJADA | Essencial | 1 / 3 / 10 por plano |
| Serviços por profissional | PLANEJADA | Essencial | — |
| Horário do estabelecimento | PLANEJADA | Essencial | — |
| Horário por profissional | PLANEJADA | Essencial | — |
| Pausas, folgas e bloqueios | PLANEJADA | Essencial | — |
| Cálculo de disponibilidade | PLANEJADA | Essencial | — |
| Prevenção de double booking | PLANEJADA | Interna | — |
| Agendamento / Appointment | PLANEJADA | Essencial | Sem limite comercial inicial |
| priceSnapshot / durationSnapshot | PLANEJADA | Interna | — |
| Cancelamento | PLANEJADA | Essencial | — |
| Remarcação | PLANEJADA | Essencial | — |
| Status do atendimento | PLANEJADA | Essencial | — |
| No-show | PLANEJADA | Essencial | — |
| Agendamento sem login obrigatório | PLANEJADA | Essencial | — |
| Cadastro de clientes | PLANEJADA | Essencial | Sem limite comercial inicial |
| Histórico do cliente | PLANEJADA | Essencial | — |
| Página pública do tenant | PLANEJADA | Essencial | 1 tenant |
| Link de agendamento | PLANEJADA | Essencial | 1 tenant |
| Branding básico | PLANEJADA | Essencial | — |
| WhatsApp manual / link | PLANEJADA | Essencial | — |
| Múltiplas profissionais | PLANEJADA | Pro | 3 no Pro / 10 no Premium |
| Lembretes automáticos | PLANEJADA | Pro | Depende de provedor |
| Lista de espera | DEFERRED | Pro | — |
| Relatórios básicos | DEFERRED | Pro | — |
| Fidelidade | DEFERRED | Pro | — |
| Pacotes | DEFERRED | Premium | — |
| Comissões | DEFERRED | Premium | — |
| Financeiro / caixa | DEFERRED | Premium | — |
| Estoque | DEFERRED | Premium | — |
| Relatórios avançados | DEFERRED | Premium | — |
| CRM avançado | DEFERRED | Premium | — |
| Profissional extra acima de 10 | DEFERRED | Add-on | +1 por add-on |
| Onboarding assistido | PLANEJADA | Add-on | Serviço avulso |
| Migração complexa | DEFERRED | Add-on | Sob consulta |
| WhatsApp oficial/API paga | DEFERRED | Add-on | Conforme provedor |
| Domínio personalizado | DEFERRED | Add-on | — |
| Catálogo de planos | PLANEJADA | Interna | — |
| Entitlements | PLANEJADA | Interna | — |
| Feature gating | PLANEJADA | Interna | — |
| Limits | PLANEJADA | Interna | professionals_active, tenant_admins |
| Backend validation de plano | PLANEJADA | Interna | — |
| Subscription status | PLANEJADA | Interna | — |
| Entitlement overrides | PLANEJADA | Interna | — |
| Demo mode | PLANEJADA | Interna | — |
| Trial | PLANEJADA | Interna | 14 dias proposto |
| Landing do SaaS | PLANEJADA | Interna | — |
| Pricing page | PLANEJADA | Interna | — |
| Cobrança automática | DEFERRED | Interna | — |

## Decisões comerciais

Distribuição por plano e limites comerciais: **APROVADOS**.

Os estados de implementação permanecem exatamente os já registrados; aprovação comercial não implica implementação.

Estado de implementação permanece inalterado.

## Leitura correta

- `PLANEJADA` significa definida na especificação, não implementada.
- `DEFERRED` significa explicitamente fora do escopo atual.
- Nenhuma funcionalidade foi classificada como `IMPLEMENTADA` ou `EM IMPLEMENTAÇÃO` porque a auditoria usada como fonte não comprovou código real.
- Segurança, isolamento, integridade e prevenção de double booking são **Internas**, não benefícios pagos.