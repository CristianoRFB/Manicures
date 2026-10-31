# STATUS — Manicure

## Fases
- CORE_FIRST: implementado e validado anteriormente (evidência CI 40509478867).
- GLOBAL_STANDARD_V01: em implementação nesta branch; pricing, catálogo, trial, demo, quotas, overrides, plano manual e downgrade sem exclusão de dados existem no código.
- Produção: **NÃO DEPLOYED**. PR #1 foi integrada por squash na `main` (commit `9eafdccf2f9cd7298822f9f4cbe449b91f6e49b7`). Merge de código NÃO é deploy.

## Medição técnica
**41/42 = 97,6% CODE_COMPLETE estimado**, tomando como denominador o baseline 42 da fase anterior.
Inclui QA em navegador DEMO/emuladores, mas NÃO inclui deploy, staging real, métricas do provedor, dados reais nem features comerciais DEFERRED.
Ver `docs/PRE_PC_COMPLETENESS.md`.

## Evidência por módulo
- M1 Global v01: PlanCatalog, EntitlementService, FeatureGating em frontend/Rules/Worker, quotas 1/3/10 profissionais e 0/2/5 admins, demo, trial e atribuição manual com auditoria.
- M2 Agenda/serviços: CRUD de serviço com arquivamento, edição de profissional/serviços vinculados, expediente semanal, pausas, folgas, booking por slots e CAS, remarcação atômica, status/no-show e histórico preservado.
- M3 UX: painel privado do tenant, agenda profissional filtrada, autoatendimento de cliente verificado, cancelamento próprio, editor white-label e histórico admin.
- M4 Operação: convites 48h de uso único permitem novos vínculos e transições seguras de customer/professional/admin com CAS e quotas; reconciliação de staff, downgrade sem exclusão, CSV, recuperação Firebase e isolamento A×B.
- M5 Qualidade: CI TypeScript, unitários inclusive comerciais e parser de limites, Worker, Auth/Firestore/Storage Emulator com exclusão física fictícia, Playwright real desktop/mobile com screenshots DEMO, build e docs check; `npm run test:pre-pc`.

## Otimização adicional de escalabilidade
- Consulta de disponibilidade usa `runQuery` com filtros por profissional/data para locks, e interseção de intervalo para bloqueios que atravessam dias. Requer aplicar os índices compostos versionados em `firestore.indexes.json` antes de homologar staging/produção; CI de emulador não comprova que os índices foram implantados em cloud.

- A verificação de reservas futuras para alteração de expediente, desativação e remoção de serviços, bem como sobreposição de folgas, utiliza consultas filtradas em vez de enumerar todo o histórico do tenant. Exportação completa permanece intencionalmente um fluxo separado com limite explícito.

## Incompleto (não afirmar pronto)
- Reservas guest antigas: pedido autenticado, revisão independente manual do studio e vínculo CAS auditado implementados; nenhuma associação automática por telefone e nenhum dado real migrado.
- Convites de entrega manual e transição de membros existentes implementados; transferências de tenant_owner deliberadamente proibidas, sem envio automático de e-mail.
- Mídia: execução física implementada, mas DESABILITADA por padrão; exige Platform Owner, pré-aprovação, geração exata, CAS, verificação no Storage e audit log. Testes com Firebase Storage Emulator real; ainda falta staging, validação de IAM, governança de egress/caches/backups e LGPD total (docs/STORAGE_DELETION_RUNBOOK.md).
- Trial de 14 dias mantém trialUntil em edições repetidas; UI avisa vencimento, expiração e suspensões. Estado comercial continua manual, sem cobrança automática.
- Chromium desktop/mobile com screenshots REAIS do DEMO e telas privadas com Firebase Emulators sintéticos executados em Actions; ainda faltam QA em staging, dispositivo físico, acessibilidade profunda e deploy.

## Preservações
- Tenant A × Tenant B e autenticação forte são CORE, nunca Premium.
- Preços, nomes e limites APROVADOS permanecem intactos.
- Sem gateway, checkout, billing, automações pagas, deploy ou biblioteca npm global.
- Sem acesso a dados/segredos de produção.

Leia `docs/CURRENT.md` para fonte vigente; consulte Actions do **SHA final** antes de declarar CI PASS.

## Gate de merge (separado de deploy)
Após revisão e CI completos, o código pode ser integrado na `main` sem iniciar produção. `npm run release:gate` bloqueia configurações destrutivas versionadas; staging/IAM/egress e QA físico continuam exigências externas.
