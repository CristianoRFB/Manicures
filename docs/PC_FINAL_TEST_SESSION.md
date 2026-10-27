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

**STOP conhecido:** o Worker de administração valida tokens assinados via JWKS de produção; os ID tokens sem assinatura do Auth Emulator ainda não são suportados para execução interativa em tela. O teste automatizado do Worker usa tokens sintéticos ASSINADOS na suíte de integração e não comprova essa integração de login E2E. Resolver em estágio separado estritamente local antes de afirmar PASS_REAL no navegador; nunca aceitar unsigned tokens no Worker de produção.

## Matriz
- Tenant A vs B: tentar trocar slug/tenantId e ler/escrever recursos privados deve ser rejeitado.
- Platform Owner: atribuir plano e overrides com auditoria; não fazer alterações em dados reais.
- Planos: Essencial 1 profissional/0 admin adicional; Pro 3/2; Premium 10/5.
- Trial: 14 dias; testar vigente, vencido, demo fictícia, suspenso/cancelled.
- Profissionais: criação por quota, desativação bloqueada com reserva futura, reativação com quota após downgrade.
- Serviços: preço em centavos, duração, cadastro, atualização/remoção: **STOP se fluxo não implementado**.
- Booking: acesso público, disponibilidade sem PII, concorrência, cancelamento libera slot.
- Agendamentos: pending → confirmed → in_service → completed e cancelled/no_show.
- Quatro viewports: 320, 375, 768 e 1440 px; Chrome, Firefox, Edge.
- Storage e white-label: uploads/permissões reais permanecem pendentes.
- Nunca apresentar mockup conceitual como screenshot de UI real.

## Critérios de parada
Interromper diante de quebra de tenant isolation, falha de Rules, quota excedida, duas reservas na mesma vaga, vazamento de PII, autorização indevida, dados reais detectados, CI vermelho ou segredo em log.

## Reversão
Sem deploy/merge automático. Em caso de falha, criar commits corretivos na branch. Dados do emulator são descartáveis; dados reais não podem ser alterados nem restaurados a partir de fixtures.
