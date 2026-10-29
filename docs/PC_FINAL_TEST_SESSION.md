# PC_FINAL_TEST_SESSION — Manicure

ESTADO: preparação de homologação, NÃO autorização de produção.

## Pré-requisitos
- Workspace separado, Git na branch `feat/core-multitenant-firebase`.
- Node 22, npm e Java 21 para Firebase Emulator Suite.
- Firebase Auth/Firestore/Storage Emulators (nunca apontar seed ao Firebase real).
- Web app com `.env.local` preenchido a partir de `.env.example`, somente configurações sintéticas.
- Não usar dados, chaves de Service Account ou usuários de produção.

## Sequência reproduzível
```bash
git fetch origin
git checkout feat/core-multitenant-firebase
git pull --ff-only
npm install --no-audit --no-fund
npm run test:pre-pc
```

Em terminais separados:
```bash
npm run emulators
npm run emulators:seed
npm run dev
npx wrangler dev --config worker/wrangler.toml
```

**Auth Emulator local:** agora há suporte real no Worker, testado em CI, mas ainda deve ser homologado visualmente. A exceção a tokens sem assinatura é restrita a `manicure-demo` com Firestore em `127.0.0.1:8080` e Auth em `127.0.0.1:9099`; fora desse modo local, tokens RS256 são obrigatórios.

Copiar `worker/.dev.vars.example` para `worker/.dev.vars` em ambiente local, sem segredos reais. Ajustar `.env.local` com configuração fictícia correspondente:

```dotenv
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=manicure-demo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=manicure-demo
VITE_FIREBASE_STORAGE_BUCKET=manicure-demo.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=demo-manicure-app
VITE_USE_FIREBASE_EMULATORS=true
VITE_DEMO_MODE=false
VITE_BOOKING_API_BASE_URL=http://127.0.0.1:8787
```

**STOP se** algum script tentar Firebase de produção, credencial real ou se o navegador executar sem os emuladores locais.


## Matriz
- Tenant A vs B: tentar trocar slug/tenantId e ler/escrever recursos privados deve ser rejeitado.
- Platform Owner: atribuir plano e overrides com auditoria; não fazer alterações em dados reais.
- Planos: Essencial 1 profissional/0 admin adicional; Pro 3/2; Premium 10/5.
- Trial: 14 dias; testar vigente, vencido, demo fictícia, suspenso/cancelled.
- Profissionais: criação por quota, desativação bloqueada com reserva futura, reativação com quota após downgrade.
- Serviços: preço em centavos, duração, cadastro, edição, arquivamento/reativação; não excluir histórico.
- Booking: acesso público, disponibilidade sem PII, concorrência, remarcação transfere locks, cancelamento libera slot, comprovante em memória.
- Agendamentos: pending → confirmed → in_service → completed e cancelled/no_show; no-show futuro negado.
- Quatro viewports: 320, 375, 768 e 1440 px; Chrome, Firefox, Edge.
- White-label: edição nome, cores, logo-texto e contatos aprovada pelo owner; Storage: uploads/permissões reais permanecem pendentes.
- Nunca apresentar mockup conceitual como screenshot de UI real.

## Critérios de parada
Interromper diante de quebra de tenant isolation, falha de Rules, quota excedida, duas reservas na mesma vaga, vazamento de PII, autorização indevida, dados reais detectados, CI vermelho ou segredo em log.

## Reversão
Sem deploy/merge automático. Em caso de falha, criar commits corretivos na branch. Dados do emulator são descartáveis; dados reais não podem ser alterados nem restaurados a partir de fixtures.
