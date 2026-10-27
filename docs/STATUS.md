# STATUS

## Stage
`CORE_FIRST` concluído no código desta branch.

## READINESS_STATUS
`READY_FOR_GLOBAL_STANDARD_IMPLEMENTATION`

## Evidência
Código CORE validado no commit:
`3667c1ef6137be80ebbd147c7a11f59cc33a3f8c`

GitHub Actions:
- run: `40509207543`
- typecheck: PASS
- unit tests: PASS
- Worker typecheck: PASS
- Firebase Emulator Suite (Rules + Booking Worker): PASS
- docs:check: PASS
- build: PASS

## Readiness Gate
| Requisito | Estado | Evidência |
|---|---|---|
| Tenant resolver confiável | PASS | resolver por tenantSlugs + teste unitário |
| Isolamento Tenant A × Tenant B | PASS | Rules emulator + Worker lock isolation |
| Memberships/RBAC | PASS | Rules emulator por roles e membership disabled |
| Security Rules/backend tenant-aware | PASS | Firestore/Storage Rules + Booking Worker |
| Platform Owner | PASS | platformUsers + acesso global explícito e auditável |
| Fonte de verdade do repo | PASS | GitHub CristianoRFB/Manicures |
| Feature states auditados | PASS | docs/consolidation/FEATURE_MATRIX_APPROVED.md |
| Pricing/feature matrix aprovada | PASS | docs/consolidation + decisões vigentes |

## Implementação comprovada nesta branch
- Firebase Auth real por configuração/env;
- FirestoreRepository;
- Tenant resolver por slug/status;
- memberships/RBAC;
- Platform Owner;
- Tenant A e Tenant B DEMO isolados;
- Firestore/Storage Rules tenant-aware;
- criação pública direta de Appointment bloqueada;
- Booking Worker confiável com locks determinísticos e snapshots;
- testes negativos de privilege/cross-tenant/tenantId swap/suspensão;
- CI e documentação visual baseline.

## Não significa
- não houve deploy em produção;
- não houve escrita em Firebase de produção;
- não houve deploy do Worker em produção;
- não houve merge na main;
- screenshots reais de navegador continuam pendentes por ausência de execução browser/local interativa nesta ferramenta;
- Global Standard de pricing/entitlements ainda NÃO foi implementado.

## Próximo estágio permitido
Global Standard v01: PlanCatalog, EntitlementService, FeatureGating, Limits, DemoMode, SubscriptionStatus, TenantOverrides, ManualPlanAssignment e downgrade preservando dados — em trabalho separado.

## Progresso após o CORE — Global Standard v01 em implementação

Checkpoint de código validado: `9974c9097ca89c78d274ec9a553056b1b706b063`.
GitHub Actions `40552172206`: **PASS**.

A situação `READY_FOR_GLOBAL_STANDARD_IMPLEMENTATION` acima é o readiness de **entrada** do CORE, não significa implementação final do Standard.

Módulos adicionados à branch desde o CORE:
- PlanCatalog Essencial / Pro / Premium e pricing aprovado;
- EntitlementService, SubscriptionStatus, trial, demo, limits e overrides;
- manual plan assignment com auditoria;
- quotas transacionais de profissionais e administradores;
- frontend Platform Owner para plano, limites, overrides e administradores;
- status de atendimentos, disponibilidade pública e proteção de reservas;
- profissional ativo/inativo com CAS, proteção de bookings futuros;
- correção de pausa do almoço, preço BRL e isolamento de estado visual entre tenants;
- novos testes unitários e de Firebase Emulator.

**Ainda incompleto:** edição de serviços/profissionais, agendas configuráveis e exceções, remarcação, cliente e profissional self-service, histórico, editor white-label, exportação, fluxos finais de storage/mídia, autenticação interativa do Auth Emulator no Worker e QA visual real.

Cobertura mensurada, sem inflar parciais: **24/42 = 57,1%**.
Veja `docs/PRE_PC_COMPLETENESS.md` e `docs/PC_FINAL_TEST_SESSION.md`.

Sem merge, deploy, dados de cliente ou integração paga.
