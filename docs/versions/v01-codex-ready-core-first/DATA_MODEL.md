# DATA MODEL

- `tenants/{tenantId}`
- `tenantSlugs/{slug}` → `{ tenantId, status }`
- `memberships/{tenantId}_{userId}` → userId, tenantId, role, status, professionalId?/customerId?
- `platformUsers/{uid}` → role=platform_owner, status
- `tenants/{tenantId}/services/{serviceId}`
- `tenants/{tenantId}/professionals/{professionalId}`
- `tenants/{tenantId}/appointments/{appointmentId}`
- `tenants/{tenantId}/bookingLocks/{professionalId}_{dateKey}_{minute}`
- `tenants/{tenantId}/customers/{customerId}`
- `tenants/{tenantId}/scheduleBlocks/{blockId}`
- `tenants/{tenantId}/auditLogs/{logId}`

Appointment preserva `priceSnapshotCents` e `durationSnapshotMin`.
`bookingLocks` pertencem à infraestrutura de concorrência e não são feature comercial.
