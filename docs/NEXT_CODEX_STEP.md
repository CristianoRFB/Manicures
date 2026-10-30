# NEXT CODEX STEP / CONTINUIDADE VIA CHAT

Última etapa: implementação direta na branch segura com CI, sem enviar ao Codex e sem deploy.
Os quinze módulos concluídos desde 24/42 estão detalhados em `docs/PRE_PC_COMPLETENESS.md`.
É proibido repetir CORE_FIRST e migrar para outra stack.

Foco do código faltante:
1. Transição customer/professional/admin por novo convite verificado já existe, sem mudança arbitrária de tenant_owner. Próximos passos: convites com envio transacional quando aprovado, recuperação administrativa e casos legados realmente excepcionais.
2. Mídia: exclusão física protegida, tombstone auditável e recuperação após interrupção implementadas e validadas no Storage Emulator real. FALTA homologar GCS staging, IAM, links/caches, backups, legados e custos/capacidade/egress. Flag `MEDIA_DELETION_ENABLED` fica desligada.
3. Trial de 14 dias idempotente, aviso de vencimento e operação manual de estado já existem; pendente homologação operacional de suspensão/reativação, migração excepcional e testes adicionais de concorrência.
4. QA real de browser mobile/desktop, screenshots autênticas e staging. Não simular screenshots.

Para verificar no PC: `npm run test:pre-pc`, `docs/PC_FINAL_TEST_SESSION.md`.
Não implementar billing, gateway ou marketplace prematuramente.
