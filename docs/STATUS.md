# STATUS — Manicure

## Fases
- CORE_FIRST: implementado e validado anteriormente (evidência CI 40509478867).
- GLOBAL_STANDARD_V01: em implementação nesta branch; pricing, catálogo, trial, demo, quotas, overrides, plano manual e downgrade sem exclusão de dados existem no código.
- Produção: **NÃO DEPLOYED**. PR ainda draft e sem merge na main.

## Medição técnica
**38/42 = 90,5% CODE_COMPLETE estimado**, tomando como denominador o baseline 42 da fase anterior.
Não inclui navegador real, deploy, dados reais ou features comerciais DEFERRED.
Ver `docs/PRE_PC_COMPLETENESS.md`.

## Evidência por módulo
- M1 Global v01: PlanCatalog, EntitlementService, FeatureGating em frontend/Rules/Worker, quotas 1/3/10 profissionais e 0/2/5 admins, demo, trial e atribuição manual com auditoria.
- M2 Agenda/serviços: CRUD de serviço com arquivamento, edição de profissional/serviços vinculados, expediente semanal, pausas, folgas, booking por slots e CAS, remarcação atômica, status/no-show e histórico preservado.
- M3 UX: painel privado do tenant, agenda profissional filtrada, autoatendimento de cliente verificado, cancelamento próprio, editor white-label e histórico admin.
- M4 Operação: convites 48h de uso único permitem novos vínculos e transições seguras de customer/professional/admin com CAS e quotas; reconciliação de staff, downgrade sem exclusão, CSV, recuperação Firebase e isolamento A×B.
- M5 Qualidade: CI TypeScript, unitários, Worker, Auth/Firestore/Storage Emulator, build e docs check; comando `npm run test:pre-pc`.

## Incompleto (não afirmar pronto)
- Reservas guest antigas não são reivindicadas automaticamente pelo cliente logado, por segurança.
- Convites de entrega manual e transição de membros existentes implementados; transferências de tenant_owner deliberadamente proibidas, sem envio automático de e-mail.
- Mídia: galeria paginada, Storage Rules por tenant, fotos imutáveis, WebP sem EXIF, pausa de upload e fluxo de solicitação/revisão de remoção auditado; **exclusão física/revogação NÃO implementadas**, além de custos/egress e QA (docs/MEDIA_POLICY.md).
- Trial de 14 dias mantém trialUntil em edições repetidas; UI avisa vencimento, expiração e suspensões. Estado comercial continua manual, sem cobrança automática.
- Browser real mobile/desktop, screenshots reais, QA visual e deploy/staging.

## Preservações
- Tenant A × Tenant B e autenticação forte são CORE, nunca Premium.
- Preços, nomes e limites APROVADOS permanecem intactos.
- Sem gateway, checkout, billing, automações pagas, deploy ou biblioteca npm global.
- Sem acesso a dados/segredos de produção.

Leia `docs/CURRENT.md` para fonte vigente; consulte Actions do **SHA final** antes de declarar CI PASS.
