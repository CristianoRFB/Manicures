# ARCHITECTURE

## Estado atual
CORE_FIRST multi-tenant sobre Firebase + Booking Worker Cloudflare-ready.

## Fluxo público
`/:tenantSlug` → tenantSlugs → tenant → services/professionals → booking API → Firestore server credentials → Appointment + bookingLocks atômicos.

## Fluxo privado
Firebase Auth → membership `{tenantId}_{uid}` / platformUsers → Firestore Rules → tenant admin ou Platform Owner.

## Isolamento
Dados operacionais ficam abaixo de `tenants/{tenantId}`. Memberships carregam tenantId e role. Rules bloqueiam acesso cruzado e o Platform Owner é explícito, não uma membership comum.

## Booking confiável
O browser não possui permissão para criar Appointment diretamente. O Worker valida tenant, service, professional, snapshots e cria `bookingLocks` determinísticos com precondition `exists=false` no mesmo commit do Appointment.

## Pricing
Global Standard completo permanece fora deste CORE.
