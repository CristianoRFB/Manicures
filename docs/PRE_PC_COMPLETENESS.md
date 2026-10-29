# PRE_PC_COMPLETENESS — Manicure

## Baseline e avanço mensurável
- Baseline do turno anterior: **24/42 = 57,1%**.
- Novo checkpoint: **34/42 = 81,0%** — avanço de **+10 entregas**, sem mudar o denominador.

As dez entregas promovidas para CODE_COMPLETE **só permanecem assim com CI do SHA final verde**:

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

**Melhorias sem adicionar ao numerador:** Galeria persistente de imagens reais e Storage Rules separadas por papel e tenant (mídia ainda com governança parcial), recuperação oficial de senha, Auth Emulator local com guardas e login testado, histórico agrupado para admin, comprovante in-session, validação de PII no booking, no-show após horário, responsividade CSS, correção de estados de rota.

## Pendências ainda reais (8/42)
- Histórico do cliente autenticado somente para reservas criadas com vínculo verificado; reservas guest anteriores exigem processo específico de titularidade e não podem ser reivindicadas por telefone.
- Convites verificados para equipe, reatribuição e demais papéis ainda pendentes; recuperação de senha via Firebase Auth já existe.
- Downgrade com alerta de excedente implementado; reconciliação legada e suporte detalhado de trial/suspensão ainda pendentes.
- Mídia: Storage Rules e portfólio público persistente implementados, mas governança completa de capacidade/egress, remoção LGPD e privacidade/EXIF não concluídas (ver docs/MEDIA_POLICY.md).
- QA/browser mobile + screenshots reais e staging/deploy (external gates não equivalem a DONE).
- Dependências de planos NEXT/DEFERRED não são declaradas implementadas.

## Estado de segurança
- Backend continua enforcement: Rules + Worker; esconder botão não concede permissão.
- Staff/profissional/tenant têm isolamento testado A×B.
- Worker local Auth Emulator só é permitido para `manicure-demo` em `127.0.0.1`, com sessão reconhecida pelo Auth Emulator.
- Produção e merge não foram alterados.

## Próxima rodada
Continuar do HEAD verificado da branch `feat/core-multitenant-firebase`. Não repetir CORE nem auditorias anteriores.
Priorizar convites de equipe, governança de mídia, reconciliar contadores legados e QA real de navegador/staging.
