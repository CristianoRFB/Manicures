# Staging read-only smoke — Manicure

**Status:** ferramenta implementada; NÃO é prova de que algum staging ou produção foi homologado. Não faz deploy, não usa conta Firebase, não envia dados pessoais, não gera agendamentos, não modifica Firestore/Storage.

## Uso quando a infraestrutura EXTERNA estiver pronta
GitHub Actions → **Staging read-only smoke** → Run workflow. Informar:
- `web_origin`: URL HTTPS exata do frontend isolado de staging (ex.: `https://studio-staging.example.com`);
- `api_origin`: URL HTTPS exata do Worker de staging (ex.: `https://api-staging.example.com`).

Alternativa local: `STAGING_WEB_ORIGIN=https://... STAGING_API_ORIGIN=https://... npm run qa:staging:smoke`. Para validar o código da ferramenta sem rede: `npm run qa:staging:smoke:test`.

## Cinco verificações não destrutivas
1. HTML do frontend servido por HTTPS.
2. `GET /health`: identidade do Worker, CORS de frontend exato, `no-store`, `nosniff`, `Vary: Origin`.
3. `OPTIONS /api/bookings`: preflight autorizado, sem criar reservas.
4. `OPTIONS` com origem alheia: 403 sem permissão CORS.
5. `GET /api/availability` com identificadores inválidos: 400, sem consulta de dados reais nem gravação.

O script rejeita HTTP, localhost, IPs literais e URL com caminho/query/usuário, falha em redirects e usa timeout por requisição. **Não** interpreta sucesso de cinco probes como aprovação de produção.

## GATE EXTERNO AINDA ABERTO
Separadamente: Firebase Auth com usuários fictícios específicos do staging; Security Rules A×B reais; GCS/IAM, geração e metadata; medição Cloud Billing/egress por período e orçamento; caches/URLs/backup e LGPD; testes em dispositivos físicos, perfis, acessibilidade e aceite do responsável. Media deletion continua desligada. Não alterar pricing nem habilitar cobrança automática.
