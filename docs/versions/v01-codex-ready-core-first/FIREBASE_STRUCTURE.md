# FIREBASE_STRUCTURE

## Estado baseline pré-Codex

Existem no artefato:

- `src/lib/firebase.ts` como adapter/configuração;
- `firebase.json`;
- `firestore.rules`;
- `storage.rules`;
- `firestore.indexes.json`.

Firebase Auth real, repositório Firestore real, memberships persistidas e validação completa por Emulator ainda pertencem ao próximo GOAL CORE_FIRST.

## Obrigação pós-implementação

Depois do CORE real estar implementado, documentar somente o que existir de verdade:

- projeto/configuração Firebase usada pela aplicação;
- Auth/providers;
- collections e ownership por tenant;
- memberships/RBAC;
- índices;
- Storage paths;
- Firestore Rules;
- Storage Rules;
- Functions/Workers quando existirem;
- emulator/test strategy;
- migrações/backfills aplicados.

Não registrar secrets.
