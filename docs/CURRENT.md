# CURRENT

CURRENT VERSION:
`v01-codex-ready-core-first`

## Estado técnico
`READY_FOR_GLOBAL_STANDARD_IMPLEMENTATION`

A versão canônica continua em:
`docs/versions/v01-codex-ready-core-first/`

O CORE multi-tenant foi implementado e validado. O Global Standard v01 **já está parcialmente implementado** nesta branch, conforme autorização posterior do usuário.

Para estado efetivo de código e pendências, consultar `docs/STATUS.md` e `docs/PRE_PC_COMPLETENESS.md`. Para homologação sintética consultar `docs/PC_FINAL_TEST_SESSION.md`.
Para ciclo de vida de mídia e procedimentos protegidos, consultar `docs/MEDIA_POLICY.md` e `docs/STORAGE_DELETION_RUNBOOK.md`. A exclusão física de mídia foi exercitada no Firebase Storage Emulator, mas fica desabilitada por padrão e não foi homologada em staging ou produção.
Não declarar COMPLETE ou DEPLOYED somente por CI verde.

## Fonte de verdade
- código: PR #1 na branch `feat/core-multitenant-firebase` até revisão/merge. Após integração verificada, a fonte de código passa a ser `main` no SHA do merge;
- documentação vigente: esta versão;
- decisões comerciais: `docs/consolidation/`.

## Regra
Antes de alterar arquitetura, banco, Auth, tenants, pricing, white-label, rotas, segurança ou deploy, leia este arquivo e a documentação vigente.

Não confundir:
- código/CI = evidência técnica;
- screenshot real = evidência visual de UI executada;
- diagrama = representação técnica;
- generated visual = conceito.

Evidências de navegador: `docs/BROWSER_QA_EVIDENCE.md` e `docs/versions/v01-codex-ready-core-first/SCREENS.md`. Fluxo guest legado: `docs/GUEST_HISTORY_LINKING.md`.
