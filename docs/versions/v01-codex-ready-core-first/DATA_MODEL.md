# DATA_MODEL

## Tenant

- id
- slug
- name
- status
- kind
- branding
- contact
- businessSettings

Campos comerciais futuros estão modelados como opcionais em `FutureCommercialState`, mas não têm gating implementado.

## Membership

- id
- userId
- tenantId
- role
- status

ID recomendado para regras simples: `<tenantId>_<userId>`.

## Service

- tenantId
- name
- description
- priceCents
- durationMin
- active

## Professional

- tenantId
- name
- active
- serviceIds

## Appointment

- tenantId
- customerName/customerPhone
- professionalId
- serviceId
- startsAt/endsAt
- priceSnapshotCents
- durationSnapshotMin
- status
- timestamps

## Collections alvo

```text
tenants/{tenantId}
memberships/{tenantId_userId}
platformUsers/{uid}
tenants/{tenantId}/services/{serviceId}
tenants/{tenantId}/professionals/{professionalId}
tenants/{tenantId}/appointments/{appointmentId}
tenants/{tenantId}/customers/{customerId}
tenants/{tenantId}/scheduleBlocks/{blockId}
```
