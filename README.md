# SaaS Manicure — CORE FIRST

Base React/Vite/TypeScript para o SaaS Manicure Multi-Tenant White-Label.

## Estado
Esta branch implementa o CORE necessário antes do Global Standard completo de pricing/entitlements:

- Firebase Auth;
- Firestore repository;
- memberships/RBAC;
- Platform Owner;
- Tenant A × Tenant B;
- Rules tenant-aware;
- Booking Worker confiável com proteção de concorrência;
- documentação e testes.

## Setup
```bash
cp .env.example .env.local
npm install
npm run typecheck
npm test
npm run worker:check
npm run test:rules
npm run docs:check
npm run build
```

## Emulator local
```bash
npm run emulators
# em outro terminal
npm run emulators:seed
npm run dev
# Worker
npx wrangler dev --config worker/wrangler.toml
```

A sessão privada DEMO fake foi removida. Para áreas privadas use Auth real/emulator.

## Booking Worker
Configurar secrets no ambiente do Worker:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Nunca versionar esses valores.

## Documentação
Leia `docs/CURRENT.md` primeiro.
