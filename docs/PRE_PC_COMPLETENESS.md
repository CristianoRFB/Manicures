# PRE_PC_COMPLETENESS — Manicure

## Baseline e avanço mensurável
- Baseline do turno anterior: **24/42 = 57,1%**.
- Novo checkpoint: **39/42 = 92,9%** — avanço de **+15 entregas**, sem mudar o denominador.

As quinze entregas promovidas para CODE_COMPLETE **só permanecem assim com CI do SHA final verde**:

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

**Melhorias sem adicionar ao numerador:** Workflow de solicitação/revisão de retirada de mídia, auditado e não destrutivo, e reforço da imutabilidade no Storage Emulator;  Galeria persistente de imagens reais e Storage Rules separadas por papel e tenant (mídia ainda com governança parcial), recuperação oficial de senha, Auth Emulator local com guardas e login testado, histórico agrupado para admin, comprovante in-session, validação de PII no booking, no-show após horário, responsividade CSS, correção de estados de rota.

## Pendências ainda reais (3/42)
- Histórico do cliente autenticado somente para reservas criadas com vínculo verificado; reservas guest anteriores exigem processo específico de titularidade e não podem ser reivindicadas por telefone.
- Convites verificados também permitem migração de membership existente customer/professional/admin sem acesso direto nem apagar histórico. Transferência de tenant_owner e novos papéis fora do catálogo NÃO são suportados, deliberadamente.
- Trial aprovado de 14 dias é idempotente em edições e possui avisos no painel, inclusive expirado/suspenso; operação manual de estado por Platform Owner. Cobrança e renovação automáticas permanecem DEFERRED.
- Mídia: exclusão física condicional com CAS, geração e ausência no Firebase Storage Emulator, ledger/tombstone, revisão e opt-in de ambiente implementados; **desabilitados por padrão e sem validação em staging/produção**. Legados/UNKNOWN continuam bloqueados; ainda faltam egress/custo, backups/caches e LGPD ponta a ponta (docs/MEDIA_POLICY.md).
- QA/browser mobile + screenshots reais e staging/deploy (external gates não equivalem a DONE).
- Dependências de planos NEXT/DEFERRED não são declaradas implementadas.

## Estado de segurança
- Backend continua enforcement: Rules + Worker; esconder botão não concede permissão.
- Staff/profissional/tenant têm isolamento testado A×B.
- Worker local Auth Emulator só é permitido para `manicure-demo` em `127.0.0.1`, com sessão reconhecida pelo Auth Emulator.
- Produção e merge não foram alterados.

## Próxima rodada
Continuar do HEAD verificado da branch `feat/core-multitenant-firebase`. Não repetir CORE nem auditorias anteriores.
Priorizar telemetria de custos/capacidade/egress e política de arquivos legados, QA REAL em navegador e staging Cloud Storage, além do tratamento seguro de reservas guest históricas. Não habilitar exclusão em produção sem homologação.
