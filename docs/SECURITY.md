# SECURITY

- frontend não é enforcement;
- Firebase Auth identifica áreas privadas;
- memberships/RBAC e Platform Owner são verificados por Rules;
- Tenant A não recebe acesso privado ao Tenant B;
- membership disabled não concede acesso;
- tenant suspenso não resolve como público;
- Appointment público não pode ser criado diretamente pelo client Firestore;
- Booking Worker usa credenciais somente em secrets e revalida tenant/service/professional;
- bookingLocks + precondition `exists=false` impedem overlap concorrente na camada confiável;
- Storage separa `/public/` e `/private/` por tenant;
- segredos de Service Account nunca entram no Git.

Testes de emulator são obrigatórios antes de declarar o gate concluído.
