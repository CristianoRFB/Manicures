# BROWSER_QA_EVIDENCE — Manicure

## Proveniência (não confundir)
- **SCREENSHOT REAL:** captura gerada pelo Chromium Playwright sobre o app React/Vite efetivamente executado no GitHub Actions, seja DEMO local ou Firebase Emulators sintéticos. Não é tela de produção nem cliente real.
- **DIAGRAMA:** fonte Mermaid e SVG da arquitetura, sob `docs/versions/v01-codex-ready-core-first/diagrams/`.
- **IMAGEM GERADA:** conceito sob `docs/versions/v01-codex-ready-core-first/generated/` e nunca prova de funcionalidade.

## Comandos e cobertura
- `npm run qa:browser`: roda testes públicos com `VITE_DEMO_MODE=true`, sem conexão com Firebase real, sobre um servidor Vite efêmero. Captura home pública de tenant A e B, formulário visual de agendamento e planos comerciais aprovados.
- `npm run qa:browser:auth`: requer Auth/Firestore/Storage Emulators e seed sintético `scripts/seed-emulator.mjs`; testa login de `owner-a@example.test`, seu painel, negação ao tentar administrar tenant B e login de `platform@example.test` no painel de plataforma. Os testes não alteram conta ou pagamento real.
- O workflow `.github/workflows/ci.yml`, job `browser-demo`, publica `qa-evidence/screenshots/`, `qa-report/`, `qa-report-auth/` e `test-results/` via `actions/upload-artifact@v4`, com retenção de 14 dias. **As screenshots não são versionadas automaticamente no repositório**, e só são evidência quando esse job termina verde no SHA correspondente.
- As imagens têm nomes `desktop-chromium-*.png`, `mobile-chromium-*.png`, `desktop-auth-*.png` ou `mobile-auth-*.png`; são telas da aplicação executada, sem fotografias de clientes reais.
- Prova de credenciais e regras: a suite `npm run test:emulator` segue responsável por A×B, Auth, Firestore, Storage, Worker e concurrencies, não o screenshot.

## Gates ainda pendentes
- QA em deploy staging separado, mobile físico, redes de produção, DNS/CSP, performance/latência, acessibilidade profunda, LGPD e quotas/egress.
- Captura de fluxos com Booking Worker em ambiente staging, check-in, pagamento e funcionalidades planejadas só quando implementadas. Não inventar telas ausentes.
- Screenshots reais atuais são DEMO (inclusive áreas autenticadas com perfis **fictícios**), nunca confundidas com produção.
- Para uso fora do Actions é necessário exportar os screenshots **somente após execução validada** e atualizar `SCREENS.md` e manifestos com caminhos reais verificados. Não colocar nomes fictícios no manifesto.
