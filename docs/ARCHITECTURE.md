# ARCHITECTURE

## Estratégia

```text
Browser
→ SPA compartilhada
→ tenant resolver por slug
→ Tenant
→ domain/repository layer
→ Firebase (próximo passo)
```

Um deploy da vertical atende vários tenants.

## Core atual

- `Tenant` resolve branding/configuração.
- `Membership` modela vínculo user ↔ tenant ↔ role.
- `Service`, `Professional` e `Appointment` possuem tenantId.
- `Appointment` preserva price/duration snapshots.
- DemoRepository existe apenas para tornar a base executável sem fingir Firebase pronto.

## Routing

- `/` base técnica
- `/:tenantSlug` público
- `/:tenantSlug/book` booking
- `/app/:tenantSlug` tenant admin
- `/platform` platform owner

## Próxima etapa

Trocar DemoRepository por adapter Firestore e session demo por Firebase Auth real sem alterar o contrato de domínio.
