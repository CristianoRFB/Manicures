# STATUS — Manicure

## Fases
- CORE_FIRST: implementado e validado anteriormente (evidência CI 40509478867).
- GLOBAL_STANDARD_V01: em implementação nesta branch; pricing, catálogo, trial, demo, quotas, overrides, plano manual e downgrade sem exclusão de dados existem no código.
- Produção: **NÃO DEPLOYED**. PR ainda draft e sem merge na main.

## Medição técnica
**36/42 = 85,7% CODE_COMPLETE estimado**, tomando como denominador o baseline 42 da fase anterior.
Não inclui navegador real, deploy, dados reais ou features comerciais DEFERRED.
Ver `docs/PRE_PC_COMPLETENESS.md`.

## Evidência por módulo
- M1 Global v01: PlanCatalog, EntitlementService, FeatureGating em frontend/Rules/Worker, quotas 1/3/10 profissionais e 0/2/5 admins, demo, trial e atribuição manual com auditoria.
- M2 Agenda/serviços: CRUD de serviço com arquivamento, edição de profissional/serviços vinculados, expediente semanal, pausas, folgas, booking por slots e CAS, remarcação atômica, status/no-show e histórico preservado.
- M3 UX: painel privado do tenant, agenda profissional filtrada, autoatendimento de cliente verificado, cancelamento próprio, editor white-label e histórico admin.
- M4 Operação: convites 48h verificados e de uso único para novos admins/profissionais, quota/reconciliação manual auditada, downgrade sem exclusões, CSV, recuperação Firebase e isolamento A×B.
- M5 Qualidade: CI TypeScript, unitários, Worker, Auth/Firestore/Storage Emulator, build e docs check; comando `npm run test:pre-pc`.

## Incompleto (não afirmar pronto)
- Reservas guest antigas não são reivindicadas automaticamente pelo cliente logado, por segurança.
- Convites operacionais com código entregue manualmente; mudança segura de papel de memberships existentes e demais papéis ainda pendentes.
- Mídia: galeria persistente, Storage Rules role-scoped e recodificação WebP sem EXIF na origem; faltam tratamento legacy, remoção autorizada, orçamento/egress e QA visual (docs/MEDIA_POLICY.md).
- Downgrade sem exclusão, aviso de excedente e reconciliação de contadores pelo Platform Owner implementados; operações avançadas de trial/suspensão ainda pendentes.
- Browser real mobile/desktop, screenshots reais, QA visual e deploy/staging.

## Preservações
- Tenant A × Tenant B e autenticação forte são CORE, nunca Premium.
- Preços, nomes e limites APROVADOS permanecem intactos.
- Sem gateway, checkout, billing, automações pagas, deploy ou biblioteca npm global.
- Sem acesso a dados/segredos de produção.

Leia `docs/CURRENT.md` para fonte vigente; consulte Actions do **SHA final** antes de declarar CI PASS.
