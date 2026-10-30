# SCREENS — evidência visual da versão v01-codex-ready-core-first

| Área | Rota | Implementação | Evidência |
|---|---|---|---|
| PUBLIC DEMO A | `/demo` | DEMO React/Vite em execução, dados fictícios | Screenshot real Chromium desktop/mobile via Actions |
| PUBLIC DEMO B | `/demo-b` | DEMO tenant diferente, serviços isolados | Screenshot real Chromium desktop/mobile via Actions |
| PUBLIC BOOKING | `/demo/book` | UI real; demo não salva agendamento | Screenshot real Chromium desktop/mobile via Actions |
| PRICING | `/pricing` | Planos aprovados com indicação de funcionalidades futuras | Screenshot real Chromium desktop/mobile via Actions |
| TENANT ADMIN | `/app/demo` | Login Auth Emulator e dados sintéticos Firestore | Screenshot real Chromium desktop/mobile via Actions |
| TENANT B DENIED | `/app/demo-b` | Conta owner A bloqueada no tenant B | Screenshot real Chromium desktop/mobile via Actions |
| PLATFORM OWNER | `/platform` | Login Auth Emulator e painel de plataforma sintético | Screenshot real Chromium desktop/mobile via Actions |

## Local e limites de evidência

As screenshots reais são geradas pelo job `browser-demo` em `.github/workflows/ci.yml` e disponibilizadas como artefato **`manicure-real-demo-browser-evidence`** no workflow aprovado do commit. Não foram inventadas, renderizadas por IA nem adicionadas como links de arquivo que não existem no repositório.

Fontes Playwright: `tests/browser/public-demo.spec.ts` e `tests/browser/authenticated-demo.spec.ts`. Configurações: `playwright.config.ts` e `playwright.auth.config.ts`. As imagens não pertencem a `generated/`.

**Ainda pendente:** captura da aplicação em staging com backend real, QA em celulares físicos, políticas de produção, performance e acessibilidade abrangente. Screenshot DEMO não prova deploy ou prontidão comercial.

Consultar `docs/BROWSER_QA_EVIDENCE.md` para a classificação das três categorias: SCREENSHOT REAL, DIAGRAMA e IMAGEM GERADA.
