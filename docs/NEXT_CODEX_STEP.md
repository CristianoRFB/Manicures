# NEXT CODEX STEP / CONTINUIDADE VIA CHAT

Última etapa: implementação direta na branch segura com CI, sem enviar ao Codex e sem deploy.
Os doze módulos concluídos desde 24/42 estão detalhados em `docs/PRE_PC_COMPLETENESS.md`.
É proibido repetir CORE_FIRST e migrar para outra stack.

Foco do código faltante:
1. Convites 48h para novas memberships já implementados (entrega manual do código); pendentes migração/revinculação de membros existentes e outros papéis sem escalada insegura.
2. Governança de mídia: recodificação WebP sem metadados dos novos uploads já existe; pendentes imagens legadas, remoção LGPD, capacidade/egress e upload condicionado à disponibilidade.
3. Reconciliação de contadores legacy já tem endpoint/auditoria/UI Platform Owner; pendentes trial/suspensões avançados, migração e testes adicionais de concorrência.
4. QA real de browser mobile/desktop, screenshots autênticas e staging. Não simular screenshots.

Para verificar no PC: `npm run test:pre-pc`, `docs/PC_FINAL_TEST_SESSION.md`.
Não implementar billing, gateway ou marketplace prematuramente.
