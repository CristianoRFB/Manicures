# AGENTS

Antes de alterar arquitetura, banco, autenticação, tenants, white-label, rotas, deploy, pricing ou documentação visual:

1. leia `docs/CURRENT.md`;
2. leia a versão canônica apontada por CURRENT;
3. preserve `CORE_FIRST` até o readiness gate ser realmente aprovado;
4. não implemente Global Standard de pricing/entitlements completo prematuramente;
5. segurança e isolamento nunca são feature Premium;
6. nunca misture screenshot real, diagrama técnico e imagem gerada/conceitual;
7. não invente lead real;
8. atualize apenas diagramas afetados;
9. execute `npm run docs:check` antes de concluir mudanças documentais.
