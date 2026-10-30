# NEXT CODEX STEP / CONTINUIDADE VIA CHAT

Última etapa: implementação direta na branch segura com CI, sem enviar ao Codex e sem deploy.
Os quatorze módulos concluídos desde 24/42 estão detalhados em `docs/PRE_PC_COMPLETENESS.md`.
É proibido repetir CORE_FIRST e migrar para outra stack.

Foco do código faltante:
1. Transição customer/professional/admin por novo convite verificado já existe, sem mudança arbitrária de tenant_owner. Próximos passos: convites com envio transacional quando aprovado, recuperação administrativa e casos legados realmente excepcionais.
2. Governança de mídia: recodificação WebP, galeria paginada, mídia imutável, pausa emergencial e solicitação/revisão auditada já existem; pendentes **exclusão física autorizada com prova de Storage**, revogação de URLs, tombstones, imagens legadas, custos/capacidade/egress.
3. Trial de 14 dias idempotente, aviso de vencimento e operação manual de estado já existem; pendente homologação operacional de suspensão/reativação, migração excepcional e testes adicionais de concorrência.
4. QA real de browser mobile/desktop, screenshots autênticas e staging. Não simular screenshots.

Para verificar no PC: `npm run test:pre-pc`, `docs/PC_FINAL_TEST_SESSION.md`.
Não implementar billing, gateway ou marketplace prematuramente.
