# GUEST_HISTORY_LINKING — Manicure

**Implementado em Worker + UI do cliente + UI do studio. Sem reivindicação automática por telefone.**

## Objetivo
Permitir que uma reserva ANÔNIMA existente apareça futuramente no histórico privado do titular, sem transformar um número de telefone, nome ou protocolo isolados em prova de identidade.

## Cliente
1. Autenticar com Firebase Auth, confirmar o e-mail e ativar a membership `customer` do tenant correto.
2. Em `/customer/:tenantSlug`, informar o protocolo da reserva antiga e o telefone informado na criação. O sistema devolve uma mensagem **genérica**, inclusive quando a reserva não corresponde; não revela dados pessoais nem existência de booking a terceiros.
3. O Worker registra em `tenants/{tenantId}/guestClaims/{appointmentId}_{uid}` apenas se a reserva for guest, o telefone corresponder e a conta estiver autorizada. O pedido só fica `pending_review` e não altera o agendamento.
4. A pessoa precisa entrar em contato com o studio para verificação independente. A confirmação de e-mail da conta não comprova que ela fez a reserva antiga.

## Studio
1. O proprietário/administrador consulta `/api/admin/guest-claims/list` pela interface `/app/:tenantSlug`.
2. Confere a pessoa **presencialmente** ou faz retorno para contato já mantido independentemente no studio. Não se baseia apenas em telefone/protocolo informado no pedido.
3. Para aprovar, declara `identityVerifiedOffline=true`, escolhe método `in_person` ou `independent_callback` e registra justificativa. Também pode rejeitar.
4. O Worker lê reserva, membership e claim; a aprovação vincula `customerId` na reserva e registra a revisão e audit log em **um commit atômico com CAS**. Atualiza somente `customerId` e `updatedAt` da reserva; preço, horário, snapshots, locks e status não mudam.
5. Outro tenant ou cliente não pode revisar; duas aprovações concorrentes não geram dupla atribuição. O vínculo não pode sobrescrever `customerId` existente.
6. O cliente atualiza a área pessoal e passa a consultar histórico pelo `customerId` autenticado.

## API
- `POST /api/customers/guest-claims/request` — token de cliente com e-mail confirmado, `tenantId`, `appointmentId`, `bookingPhone`.
- `POST /api/admin/guest-claims/list` — gestão do tenant ou Platform Owner.
- `POST /api/admin/guest-claims/review` — gestão do tenant, `claimId`, `decision`, `reason`; aprovação exige `identityVerifiedOffline` e `verificationMethod`.

## Segurança e limites
- Registros `guestClaims` são fechados a toda leitura/escrita por SDK cliente nas Firestore Rules; somente o Worker confiável pode acessá-los.
- Resposta pública genérica protege contra enumeração, mas volume anormal e tentativas automatizadas ainda exigem monitoramento/rate limiting operacional.
- A verificação humana pode falhar; não declarar conformidade LGPD completa só por este fluxo.
- A operação não verifica pessoas automaticamente nem envia contatos.
- Nenhuma reserva de cliente real foi modificada nesta etapa; testes em projeto Firebase Emulator sintético.
