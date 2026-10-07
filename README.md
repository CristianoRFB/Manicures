# SaaS Manicure — CODEX-READY Base

Base criada porque o repositório associado `CristianoRFB/Manicures` está vazio e não existe codebase aproveitável disponível no Project/chat.

## Objetivo desta base

Entregar um **CORE FIRST executável**, não o produto inteiro e não o Global Standard de pricing completo.

Happy path já funcional em modo DEMO local:

```text
serviço → profissional → data/horário → agendamento → painel do tenant
```

Também existem:

- tenant resolver por slug;
- tenant DEMO explícito;
- modelo de Tenant, Membership, Service, Professional e Appointment;
- RBAC conceitual;
- shell de Platform Owner;
- shell de Tenant Owner;
- white-label básico;
- proteção contra double booking no repositório demo;
- snapshots de preço/duração no Appointment;
- Firebase Web adapter opcional;
- Firestore/Storage Rules de base;
- documentação técnica;
- testes unitários.

## O que NÃO está implementado

- Firebase Auth real;
- Firestore repository real;
- Storage write flow;
- Tenant A × Tenant B em emulator;
- migração de cliente real (não há cliente real comprovado);
- PlanCatalog/EntitlementService/FeatureGating comercial completo;
- billing/gateway;
- landing/pricing comercial.

## Rodar

```bash
npm install
npm run dev
```

Abra:

- `/demo` — página pública do tenant DEMO
- `/demo/book` — agendamento
- `/app/demo` — Tenant Owner shell
- `/platform` — Platform Owner shell

## Validar

```bash
npm run typecheck
npm test
npm run build
node scripts/check-no-secrets.mjs
```

## Firebase

Copie `.env.example` para `.env.local` e preencha somente configuração Web pública quando for ligar o Firebase real.

**Não coloque service account ou segredo de servidor no frontend.**

A base roda sem Firebase em modo DEMO local para permitir desenvolvimento imediato.

## Deploy

A saída `dist/` é compatível com hosting estático, inclusive Cloudflare Pages. `public/_redirects` suporta SPA routing.

## Status de validação

No ambiente de geração, a instalação via npm registry não ficou disponível dentro da janela de execução. Por isso o build Vite/Vitest completo não foi fingido como executado.

Foram executados com sucesso:

- compilação/smoke-check do núcleo TypeScript com o compilador local;
- testes de lógica de disponibilidade, RBAC e tenant resolver;
- scan de credenciais óbvias.

Ao abrir no Codex, execute `npm install`, `npm run typecheck`, `npm test` e `npm run build` antes de qualquer alteração funcional. Veja `docs/STATUS.md`.
## Padrão documental visual

Este artefato incorpora `SAAS_PADRAO_DOCS_LEADS_IMAGENS_GERADAS.md` como regra oficial.

Fonte documental canônica:

```text
docs/CURRENT.md
→ docs/versions/v01-codex-ready-core-first/
```

Checks preparados:

```bash
npm run docs:check
npm run docs:diagrams
npm run docs:leads
```

Nesta atualização pré-Codex:
- diagramas baseline técnicos foram adicionados e marcados para revisão pós-CORE;
- screenshots reais não foram inventados;
- imagens conceituais não foram geradas prematuramente;
- nenhum lead real foi inventado;
- a criação/captura visual final está explicitamente no fim de `CODEX_NEXT_GOAL.txt`.
