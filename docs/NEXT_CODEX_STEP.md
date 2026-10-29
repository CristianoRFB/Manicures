# NEXT CODEX STEP / CONTINUIDADE VIA CHAT

Última etapa: implementação direta na branch segura com CI, sem enviar ao Codex e sem deploy.
Os oito módulos concluídos desde 24/42 estão detalhados em `docs/PRE_PC_COMPLETENESS.md`.
É proibido repetir CORE_FIRST e migrar para outra stack.

Foco do código faltante:
1. Autoatendimento autenticado de cliente e histórico próprio, com Rules/Worker tenant-scoped.
2. Fluxo legítimo de convite/redefinição de acesso para funcionários; nunca provisionar contas por e-mail suposto.
3. Portfólio/arquivos e suas permissões tenant-aware com lifecycle persistente apropriado.
4. Refinar downgrades excedentes e experiência de trial.
5. Encerrar QA real em PC/staging distinto, screenshots só de telas reais.

Para verificar no PC: `npm run test:pre-pc`, `docs/PC_FINAL_TEST_SESSION.md`.
Não implementar billing, gateway ou marketplace prematuramente.
