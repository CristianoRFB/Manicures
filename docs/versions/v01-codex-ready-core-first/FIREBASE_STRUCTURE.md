# FIREBASE STRUCTURE

## Auth
Firebase Authentication para áreas privadas. Emulator local em `127.0.0.1:9099` quando habilitado.

## Firestore
Collections canônicas documentadas em `docs/DATA_MODEL.md`.
Rules em `/firestore.rules`.
Emulator em `127.0.0.1:8080`.

## Storage
Rules em `/storage.rules`.
Emulator em `127.0.0.1:9199`.

## Booking server-side
Cloudflare Worker em `/worker` usa Firestore REST com Service Account fornecida por secrets. O browser não recebe essas credenciais.

## Testes
`npm run test:rules` executa Rules contra Firebase Emulator Suite.
`npm run emulators:seed` prepara dois tenants DEMO e usuários de teste para execução manual local.
