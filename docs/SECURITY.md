# SECURITY

## Princípios

- frontend nunca é enforcement;
- tenantId deve ser validado em camada confiável;
- Tenant A não lê/escreve Tenant B;
- membership desativada não concede acesso;
- Platform Owner é explícito e auditável;
- segurança não é feature Premium;
- tenant suspenso não deve operar normalmente;
- nada de service account no frontend.

## Rules

`firestore.rules` fornece uma base conservadora com membership e platform owner.

Ainda precisa ser validada com Firebase Emulator Suite no próximo GOAL.

`storage.rules` bloqueia writes por padrão até a política tenant-aware ser implementada e testada.

## Booking público

A base local permite criação de appointment para demonstrar o happy path.

No Firebase real, criação pública deve passar por validação confiável que revalide:

- tenant;
- professional;
- service;
- duration;
- overlap;
- blocks/folgas;
- horário comercial;
- rate/abuse controls quando necessários.
