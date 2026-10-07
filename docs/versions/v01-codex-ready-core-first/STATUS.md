# STATUS

## Source class

`EMPTY_OR_NONVIABLE → ZIP_BASE`

## Stage

`CORE_FIRST`

## Implementado nesta base

- app React/Vite/TypeScript;
- tenant resolver;
- demo tenant;
- public booking happy path;
- tenant admin shell;
- platform owner shell;
- domain model;
- local demo repository;
- overlap protection local;
- Firestore/Storage Rules base;
- Firebase config adapter;
- tests.

## Ainda falta antes de pricing/entitlements completos

- Firebase Auth real;
- Firestore repository real;
- memberships/RBAC persistidos;
- Platform Owner real;
- isolamento A × B provado por emulator/tests;
- Rules validadas no emulator;
- backend confiável para criação de Appointment e conflitos;
- segundo tenant de teste persistido;
- documentação pós-implementação.

## Validação do pacote

Resultados no ambiente de geração:

- core TypeScript smoke compile: **PASS**;
- smoke tests de disponibilidade/RBAC/tenant resolver: **PASS**;
- `node scripts/check-no-secrets.mjs`: **PASS**;
- `npm install`: **BLOCKED_BY_ENVIRONMENT** (registry indisponível/timeout);
- `npm run typecheck`: **NOT_RUN_WITH_REAL_DEPENDENCIES**;
- `npm test` (Vitest): **NOT_RUN_WITH_REAL_DEPENDENCIES**;
- `npm run build`: **NOT_RUN_WITH_REAL_DEPENDENCIES**.

A primeira ação no Codex deve ser instalar dependências e rodar os três checks reais. Nenhum resultado foi fingido.
## Atualização pré-Codex — padrão visual/documental

- padrão `SAAS_PADRAO_DOCS_LEADS_IMAGENS_GERADAS.md`: **INCORPORADO**;
- estrutura versionada baseline: **CRIADA**;
- DIAGRAMS_MANIFEST: **CRIADO**;
- LEADS_MANIFEST: **CRIADO**;
- diagramas técnicos baseline source/rendered: **2 pares**;
- screenshots reais: **NÃO CAPTURADOS NESTA ETAPA**;
- imagens geradas/conceituais: **NÃO GERADAS NESTA ETAPA**;
- leads reais confirmados: **0**;
- `docs:check`: preparado;
- `docs:diagrams`: preparado;
- `docs:leads`: preparado.

A fase visual final permanece no encerramento do próximo GOAL, depois do CORE e build.
