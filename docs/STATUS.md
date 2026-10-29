# STATUS — Manicure

## Fases
- CORE_FIRST: implementado e validado anteriormente (evidência CI 40509478867).
- GLOBAL_STANDARD_V01: em implementação nesta branch; pricing, catálogo, trial, demo, quotas, overrides, plano manual e downgrade sem exclusão de dados existem no código.
- Produção: **NÃO DEPLOYED**. PR ainda draft e sem merge na main.

## Medição técnica
**31/42 = 73,8% CODE_COMPLETE estimado**, tomando como denominador o baseline 42 da fase anterior.
Não inclui navegador real, deploy, dados reais ou features comerciais DEFERRED.
Ver `docs/PRE_PC_COMPLETENESS.md`.

## Evidência por módulo
- M1 Global v01: PlanCatalog, EntitlementService, FeatureGating em frontend/Rules/Worker, quotas 1/3/10 profissionais e 0/2/5 admins, demo, trial e atribuição manual com auditoria.
- M2 Agenda/serviços: CRUD de serviço com arquivamento, expediente semanal por profissional, pausas, folgas e bloqueios, booking por slots e CAS, remarcação atômica, status/no-show e histórico preservado.
- M3 UX: painel privado do tenant, agenda própria de profissional com filtro Rules, editor white-label, histórico de cliente para o admin e comprovante de solicitação sem URL com PII.
- M4 Operação: membros admin adicionais com quotas, exportação CSV privada com auditoria, rejeição A×B, perfis de profissional ativos/inativos.
- M5 Qualidade: CI TypeScript, unitários, Worker, Firestore/Auth Emulator, build e docs check; comandos `npm run test:pre-pc`.

## Incompleto (não afirmar pronto)
- Cliente logado/autosserviço e histórico próprio (a visão admin já existe).
- Editar nome/associação de serviços de profissionais, fluxo de convites com recuperação oficial e gestão completa dos demais papéis.
- Tratamento e autorização completos de mídia persistente/portfólio, uploads e exportação ampliada.
- Downgrade UX para excedentes ativos, trials e suporte administrativo completos.
- Browser real mobile/desktop, screenshots reais, QA visual e deploy/staging.

## Preservações
- Tenant A × Tenant B e autenticação forte são CORE, nunca Premium.
- Preços, nomes e limites APROVADOS permanecem intactos.
- Sem gateway, checkout, billing, automações pagas, deploy ou biblioteca npm global.
- Sem acesso a dados/segredos de produção.

Leia `docs/CURRENT.md` para fonte vigente; consulte Actions do **SHA final** antes de declarar CI PASS.
