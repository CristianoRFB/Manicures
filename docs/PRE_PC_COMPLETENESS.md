# PRE_PC_COMPLETENESS — Manicure

## Baseline e avanço mensurável
- Baseline do turno anterior: **24/42 = 57,1%**.
- Novo checkpoint: **41/42 = 97,6%** — avanço de **+17 entregas**, sem mudar o denominador.

As dezessete entregas promovidas para CODE_COMPLETE **só permanecem assim com CI do SHA final verde**:

| Nº | Entrega | Código | Prova automatizada |
|---:|---|---|---|
| 1 | Editar, arquivar e reativar serviços | `src/data/firestoreRepository.ts`, `src/pages/TenantAdminPage.tsx`, Rules | `src/test/firestore.rules.test.ts` |
| 2 | Expediente semanal, intervalos e dias fechados por profissional | `worker/src/index.ts`, admin, domínio | `worker/src/index.test.ts` |
| 3 | Folgas/bloqueios e cancelamento auditado | Worker, Firestore Rules, admin | Worker emulator + Rules negativas |
| 4 | Remarcação atômica com transferência de bookingLocks | Worker e admin | Worker emulator: conflito, overlap, CAS, A×B |
| 5 | Editor white-label persistente, tenant-owner only | Worker e admin | Worker emulator: permissão e preservação do plano |
| 6 | Agenda profissional privada com ações limitadas | `src/pages/ProfessionalPage.tsx`, Repository, Rules | `src/test/firestore.rules.test.ts` (consulta própria e negação) |
| 7 | Exportar agendamentos em CSV protegido e auditado | Worker e admin | Worker emulator: A×B, CSV formula, audit log |
| 8 | Editar profissional e vínculos de serviços preservando reservas e quota | Worker e admin | Worker Emulator: CAS, serviço ativo, A×B, proibição de remoção com reserva futura |
| 9 | Conta do cliente confirmada, vínculo próprio, histórico e cancelamento | Worker /api/customers, CustomerPage, AuthProvider, BookingPage, Repository | Worker & Rules Emulator: UID, token, A×B, guest, cancelamento e locks |
| 10 | Excedentes de equipe após downgrade visíveis e sem exclusão | Worker /api/admin/usage e TenantAdminPage | Worker Emulator: Essencial 1 vs 2 profissionais, A×B |
| 11 | Convites seguros de 48h para admin e profissional, uso único, e-mail confirmado, revogação e UI | Worker, StaffInvitations, StaffInvitePage, Rules | Worker emulator: e-mail, expiração, A×B, CAS concorrente, quotas e promoção direta proibida |
| 12 | Reconciliação de quotas legacy com CAS, auditoria e UI do Platform Owner | Worker /api/platform/usage/reconcile, PlatformPage | Worker emulator: correção de contadores, autorização exclusiva e preservação da equipe |
| 13 | Mudança segura de papel em membership existente por novo convite e aceite verificado | Worker /api/invitations/accept e Rules | Worker emulator: customer→admin, admin→professional, quotas, histórico, bloqueio tenant_owner |
| 14 | Trial idempotente e visibilidade de expiração/suspensão | Worker /api/admin/plans/assign, subscriptionNotice, TenantAdminPage | Worker emulator: não prorroga trial; testes de aviso e bloqueio de estado |
| 15 | Exclusão física sob opt-in e autorização com verificação de geração, trilha auditável e retomada | Worker mediaStorage, PlatformPage, Storage Emulator, runbook | Worker Emulator real: upload, aprovação, DELETE condicional, GET ausente, tombstone; testes de falha/retry e bloqueio legacy |
| 16 | Vínculo de reservas guest históricas mediante verificação independente do studio, sem tomada por telefone | Worker guest-claims, CustomerPage, GuestHistoryReviews, Firestore Rules | Worker Emulator: aprovação CAS, vínculo em customerId, A×B, concorrência, tentativas sem prova e cancelamento próprio; Rules negativas |
| 17 | Inventário de capacidade operacional limitado e retomável, classificação de mídia legada e limiar opcional de alerta em bytes observados | Worker mediaStorage/index, PlatformPage | Worker unitário: paginação, prefixo A×B, cursor cíclico, dados inválidos; CI release:gate |

**Melhorias sem adicionar ao numerador:** Correção fail-closed do repositório (DEMO somente com flag explícita), datas pelo fuso do studio e limite de horizonte no formulário, com testes unitários/Playwright;  Data local no agendamento (sem UTC deslocado), bloqueio de datas passadas e slots obsoletos, estado acessível dos horários, navegação por teclado e remoção de links DEMO fora do modo de demonstração (teste unitário + QA Chromium);  Gate release:gate fail-closed, correção de parse de override comercial e inclusão dos testes comerciais no npm test;  QA Chromium desktop/mobile com screenshots de app DEMO em execução e acesso A×B, métricas de bytes/proveniência em inventário parcial;  Workflow de solicitação/revisão de retirada de mídia, auditado e não destrutivo, e reforço da imutabilidade no Storage Emulator;  Galeria persistente de imagens reais e Storage Rules separadas por papel e tenant (mídia ainda com governança parcial), recuperação oficial de senha, Auth Emulator local com guardas e login testado, histórico agrupado para admin, comprovante in-session, validação de PII no booking, no-show após horário, responsividade CSS, correção de estados de rota.

## Pendências ainda reais (1/42)
- Reservas guest anteriores podem ser vinculadas somente após solicitação por conta confirmada e aprovação humana com verificação independente; não existe reivindicação automática por telefone. Processo em `docs/GUEST_HISTORY_LINKING.md`; dados reais não foram migrados.
- Convites verificados também permitem migração de membership existente customer/professional/admin sem acesso direto nem apagar histórico. Transferência de tenant_owner e novos papéis fora do catálogo NÃO são suportados, deliberadamente.
- Trial aprovado de 14 dias é idempotente em edições e possui avisos no painel, inclusive expirado/suspenso; operação manual de estado por Platform Owner. Cobrança e renovação automáticas permanecem DEFERRED.
- Mídia: exclusão física condicional com CAS e prova no Storage Emulator, inventário operacional limitado/retomável e alerta por bytes observados implementados. **Ainda não existem fatura/egress, métricas Cloud Billing, homologação de IAM/GCS staging, saneamento de legados, caches/backups ou LGPD ponta a ponta.** Nada destrutivo está habilitado em produção.
- QA Chromium de telas públicas e autenticadas em desktop/mobile com Firebase Emulators sintéticos passou em Actions e publicou screenshots REAIS do DEMO como artefato. **Ainda não há staging/deploy, dispositivos físicos, QA de pagamento ou screenshots de produção** (ver `docs/BROWSER_QA_EVIDENCE.md`).
- Dependências de planos NEXT/DEFERRED não são declaradas implementadas.

## Estado de segurança
- Backend continua enforcement: Rules + Worker; esconder botão não concede permissão.
- Staff/profissional/tenant têm isolamento testado A×B.
- Worker local Auth Emulator só é permitido para `manicure-demo` em `127.0.0.1`, com sessão reconhecida pelo Auth Emulator.
- PR #1 integrada por squash na `main` no SHA `9eafdccf2f9cd7298822f9f4cbe449b91f6e49b7`; **produção e dados reais não foram alterados**.

## Próxima rodada
Continuar do HEAD verificado da `main` após a integração; não repetir CORE nem auditorias anteriores.
Priorizar GCS staging/IAM, quota/custos/egress monitorados, tratamento de legados, performance/acessibilidade, QA em dispositivos e screenshots reais em staging; manter exclusão desativada em produção até homologação.

## Critério de integração seguro
- `npm run release:gate` e CI `verify` e `browser-demo` devem estar PASS no SHA integrado.
- Código na `main` não é deployment nem aprovação jurídica/operacional de produção.
- Restante 1/42: **homologação externa de staging real, IAM, medição real de egress/custos, dispositivos físicos, backups/URLs e aceite de operação**. Exige infraestrutura e responsáveis, não pode ser falsificado por simulador.
