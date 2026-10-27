# STATUS

## Stage
`CORE_FIRST`

## Implementação atual desta branch
- React/Vite/TypeScript base preservada;
- Firebase Auth real por configuração/env;
- FirestoreRepository real para tenants, services, professionals, appointments, memberships e audit logs;
- Tenant resolver por `tenantSlugs/{slug}` + validação de status;
- memberships/RBAC persistidos;
- Platform Owner real via `platformUsers/{uid}`;
- segundo tenant DEMO B separado;
- áreas privadas sem sessão fake;
- Firestore/Storage Rules tenant-aware;
- criação pública de Appointment bloqueada no Firestore client;
- Booking Worker confiável com Service Account + locks determinísticos para impedir overlap concorrente;
- emulator seed e testes de Rules A × B;
- CI para typecheck, unit, worker, emulator rules, docs e build.

## Ainda fora deste GOAL
- PlanCatalog/EntitlementService/FeatureGating comercial completos;
- billing/gateway;
- landing/pricing;
- WhatsApp oficial;
- multi-unidade;
- NEXT/DEFERRED.

## Evidência pendente
A branch precisa passar pelo GitHub Actions no SHA final. Resultado de CI deve ser registrado antes de declarar READY_FOR_GLOBAL_STANDARD_IMPLEMENTATION.
