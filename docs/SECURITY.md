# SECURITY

- frontend não é enforcement;
- Firebase Auth identifica áreas privadas;
- memberships/RBAC e Platform Owner são verificados por Rules;
- Tenant A não recebe acesso privado ao Tenant B;
- membership disabled não concede acesso;
- tenant suspenso não resolve como público;
- Appointment público não pode ser criado diretamente pelo client Firestore;
- Booking Worker usa credenciais somente em secrets e revalida tenant/service/professional;
- bookingLocks + precondition `exists=false` impedem overlap concorrente na camada confiável;
- Storage separa `/public/` e `/private/` por tenant;
- segredos de Service Account nunca entram no Git.

Testes de emulator são obrigatórios antes de declarar o gate concluído.

## HTTP privacy and origin controls
- O Worker exige `ALLOWED_ORIGIN` como **origem exata**: HTTPS em staging/produção. `*`, listas implícitas, origem ausente e HTTP em nuvem falham com 503. HTTP loopback só com o projeto sintético e Firestore Emulator local.
- Requisições de navegadores com `Origin` diferente são rejeitadas com 403 **antes de qualquer operação** (inclusive preflight e reservas guest), sem autorização CORS. Integrações servidor-servidor sem cabeçalho `Origin` ainda precisam passar todas as verificações de identidade/autorização próprias da rota; CORS não substitui autenticação nem mitiga abusos de bots.
- JSON, preflight e CSV privado retornam `Cache-Control: private, no-store`, `Pragma: no-cache`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e `Vary: Origin`. Essas políticas não eliminam backups, logs externos nem retenções existentes.
- `worker/wrangler.toml` contém apenas origem HTTP local de desenvolvimento. Antes de staging/produção, configurar origem HTTPS real explicitamente **fora do repositório** e homologar CORS com o domínio público correto. A configuração local padrão fica bloqueada fora dos emuladores.
- Erros internos no endpoint público de reservas não retornam mensagens cruas de exceção ao navegador.
