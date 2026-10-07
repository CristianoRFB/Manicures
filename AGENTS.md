# AGENTS.md

Antes de alterar arquitetura, banco, autenticação, tenants, white-label, rotas, segurança ou deploy:

1. leia `docs/CURRENT.md`;
2. leia `docs/ARCHITECTURE.md`;
3. leia `docs/SECURITY.md`;
4. leia `docs/NEXT_CODEX_STEP.md`;
5. preserve as decisões comerciais aprovadas da vertical.

## Regras

- Este produto é uma vertical independente.
- Não criar um Firebase/deploy por tenant.
- Não criar fork por cliente.
- Não inventar cliente real.
- Tenant DEMO deve permanecer claramente marcado como DEMONSTRAÇÃO.
- Segurança não pode depender de plano comercial.
- Não implementar billing/gateway neste estágio.
- Não implementar o Global Standard completo antes do readiness do core.
## Padrão global de documentação visual

Antes de alterar documentação visual, leia:
- `docs/CURRENT.md`;
- `docs/ecosystem/SAAS_PADRAO_DOCS_LEADS_IMAGENS_GERADAS.md`;
- `docs/DIAGRAMS_MANIFEST.md`;
- `docs/LEADS_MANIFEST.md`.

A versão documental canônica é `docs/versions/v01-codex-ready-core-first/`.

Nunca misturar:
- **SCREENSHOT REAL** = prova da implementação;
- **DIAGRAMA** = representação técnica do sistema real;
- **IMAGEM GERADA** = conceito/proposta visual.

Não inventar leads. Não usar imagem gerada como prova de tela implementada.
A fase visual/documental final acontece depois de CORE, migração, testes, Tenant A × B e build.
