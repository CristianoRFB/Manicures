# SaaS Manicure — CORE FIRST

Base React/Vite/TypeScript para o SaaS Manicure Multi-Tenant White-Label.

## Estado
Esta branch contém o CORE multi-tenant e implementação **parcial** do Global Standard v01. Não está implantada em produção.

- Firebase Auth + recuperação de senha, memberships/RBAC e Platform Owner;
- Firestore e Storage Rules, com testes de isolamento Tenant A × Tenant B;
- PlanCatalog, quotas comerciais, overrides, trial/demo e atribuição manual auditada;
- Booking Worker, locks, disponibilidade, expediente, folgas e remarcação;
- gestão do studio: serviços, profissionais, agenda, identidade visual, CSV e clientes;
- área da profissional `/professional/:tenantSlug` e cliente `/customer/:tenantSlug`;
- reservas guest sem conta permanecem possíveis, mas **não** são vinculadas automaticamente ao histórico privado;
- portfólio persistente de imagens reais com normalização WebP/remoção de metadados originais, sem TTL ou exclusão automática;
- convites seguros e auditados de 48 horas para staff com validação de e-mail confirmado e quota no aceite;
- reconciliação de contadores legados exclusiva do Platform Owner, sem alterar dados da equipe.

**Métrica de engenharia pré-PC:** 36/42 (85,7%) estimada com evidências descritas em `docs/PRE_PC_COMPLETENESS.md`. Teste de navegador, staging e deploy pendentes. Consulte CI do HEAD antes de declarar PASS.

## Setup
```bash
cp .env.example .env.local
npm install
npm run typecheck
npm test
npm run worker:check
npm run test:pre-pc
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

## Novos fluxos de teste
- Cliente: confirmar e-mail no Auth Emulator, ativar perfil do tenant, reservar autenticado e cancelar somente a própria reserva.
- Storage: `npm run test:emulator` agora cobre Auth, Firestore e Storage; no app, imagens reais usam `tenants/{tenantId}/public/portfolio`.
- Worker local: copiar `worker/.dev.vars.example` para `worker/.dev.vars`, sem nenhuma chave ou dado de produção.
- Mídia: ler `docs/MEDIA_POLICY.md`; não prometer armazenamento ilimitado nem prazo genérico para exclusão.

A branch segura permanece em PR draft, sem merge e sem deploy automático.

## Convites de equipe e reconciliação
- O proprietário gera e gerencia convites pelo painel `/app/:tenantSlug`, com código de uso único e validade de 48 horas; o envio é MANUAL, ainda não há integração de e-mail transacional.
- O convidado entra em `/invite/:tenantSlug`, usa sua conta Firebase com e-mail verificado e informa o código; acesso é criado atomicamente pelo Worker.
- Convite de administrador consome quota no ACEITE. Converter contas com outros papéis exige fluxo futuro específico — promoção direta proibida.
- O Platform Owner pode reconciliar contadores divergentes no painel `/platform`, com justificativa e auditoria; isso nunca remove vínculos nem muda plano.
