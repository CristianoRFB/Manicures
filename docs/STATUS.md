# STATUS — Manicure

## Fases
- CORE_FIRST: implementado e validado anteriormente (evidência CI 40509478867).
- GLOBAL_STANDARD_V01: em implementação nesta branch; pricing, catálogo, trial, demo, quotas, overrides, plano manual e downgrade sem exclusão de dados existem no código.
- Produção: **NÃO DEPLOYED**. PR ainda draft e sem merge na main.

## Medição técnica
**34/42 = 81,0% CODE_COMPLETE estimado**, tomando como denominador o baseline 42 da fase anterior.
Não inclui navegador real, deploy, dados reais ou features comerciais DEFERRED.
Ver `docs/PRE_PC_COMPLETENESS.md`.

## Evidência por módulo
- M1 Global v01: PlanCatalog, EntitlementService, FeatureGating em frontend/Rules/Worker, quotas 1/3/10 profissionais e 0/2/5 admins, demo, trial e atribuição manual com auditoria.
- M2 Agenda/serviços: CRUD de serviço com arquivamento, edição de profissional/serviços vinculados, expediente semanal, pausas, folgas, booking por slots e CAS, remarcação atômica, status/no-show e histórico preservado.
- M3 UX: painel privado do tenant, agenda profissional filtrada, autoatendimento de cliente verificado, cancelamento próprio, editor white-label e histórico admin.
- M4 Operação: admins adicionais com quota, alerta de excedentes do downgrade, exportação CSV auditada, recuperação Firebase, equipe ativa/inativa e rejeição A×B.
- M5 Qualidade: CI TypeScript, unitários, Worker, Auth/Firestore/Storage Emulator, build e docs check; comando `npm run test:pre-pc`.

## Incompleto (não afirmar pronto)
- Reservas guest antigas não são reivindicadas automaticamente pelo cliente logado, por segurança.
- Fluxo de convites com recuperação oficial e gestão completa dos demais papéis.
- Mídia: galeria persistente real e Storage Rules role-scoped implementadas; faltam política de EXIF, remoção autorizada, orçamento/egress e homologação de uploads (docs/MEDIA_POLICY.md).
- Downgrade sem exclusão e aviso de excedente implementados; reconciliação de contadores/trial/suspensão avançados permanecem pendentes.
- Browser real mobile/desktop, screenshots reais, QA visual e deploy/staging.

## Preservações
- Tenant A × Tenant B e autenticação forte são CORE, nunca Premium.
- Preços, nomes e limites APROVADOS permanecem intactos.
- Sem gateway, checkout, billing, automações pagas, deploy ou biblioteca npm global.
- Sem acesso a dados/segredos de produção.

Leia `docs/CURRENT.md` para fonte vigente; consulte Actions do **SHA final** antes de declarar CI PASS.
