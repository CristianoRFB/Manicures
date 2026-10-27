# PROJECT_STRUCTURE

## Runtime
```text
src/
  app/
  auth/AuthProvider.tsx
  components/
  data/
    bookingApi.ts
    demoSeed.ts
    firestoreRepository.ts
    repository.ts
  domain/
  lib/firebase.ts
  pages/
  test/firestore.rules.test.ts
worker/
  src/index.ts
  wrangler.toml
scripts/
  seed-emulator.mjs
  docs-*.mjs
firestore.rules
storage.rules
firebase.json
.github/workflows/ci.yml
```

## Boundaries
- `src/data/firestoreRepository.ts`: leitura privada/pública compatível com Rules.
- `worker/src/index.ts`: criação confiável de Appointment e bookingLocks.
- `src/auth/AuthProvider.tsx`: identidade Firebase Auth.
- `firestore.rules` / `storage.rules`: enforcement tenant-aware.
- `scripts/seed-emulator.mjs`: somente DEMO/local emulator.
- `docs/`: documentação técnica/visual; não é runtime.
