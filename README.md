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
- convites seguros e auditados de 48 horas para staff, inclusive conversão verificada de customer/professional/admin; quota no aceite;
- reconciliação de contadores legados exclusiva do Platform Owner, sem alterar dados da equipe;
- trial de 14 dias sem prorrogação silenciosa, avisos de vencimento/estado;
- controle emergencial de uploads por tenant auditado e galeria paginada com 12 fotos por página;
- solicitação/revisão e exclusão física controlada de mídia com geração exata, CAS e auditoria; **desabilitada por padrão, validada somente no Storage Emulator, nunca executada em produção**.

**Métrica de engenharia pré-PC:** 41/42 (97,6%) estimada com evidências descritas em `docs/PRE_PC_COMPLETENESS.md`. Teste de navegador, staging e deploy pendentes. Consulte CI do HEAD antes de declarar PASS.

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
- Convite de administrador consome quota no ACEITE. Converter membro existente exige NOVO convite, e-mail verificado e aceite do titular, com atualização atômica e preservação do histórico; promoção direta ainda é proibida.
- O Platform Owner pode reconciliar contadores divergentes no painel `/platform`, com justificativa e auditoria; isso nunca remove vínculos nem muda plano.

## Mídia: execução física com confirmação
- `/platform` tem inventário de até 100 objetos por página (geração/tamanho) e execução após aprovação; exige confirmação literal e justificativa.
- `MEDIA_DELETION_ENABLED` ausente/false impede todas as remoções; `FIREBASE_STORAGE_BUCKET` obrigatório, credencial de serviço e revisão prévia. Não habilitar em produção sem QA staging e processo autorizado.
- Teste de exclusão de arquivo fictício rodou no Firebase Storage Emulator real; caches externos e backups não são eliminados por isso.
- Fluxo completo e suas limitações: `docs/STORAGE_DELETION_RUNBOOK.md`.

## Verificações de navegador e recuperação de histórico
- `npm run qa:browser` captura as telas públicas em Chromium desktop/mobile com DEMO local e **sem dados reais**.
- `npm run qa:browser:auth` captura áreas privadas com Auth/Firestore Emulators sintéticos após `scripts/seed-emulator.mjs`; CI guarda os screenshots em artefato Actions por 14 dias.
- `/customer/:tenantSlug` permite pedir revisão de um agendamento antigo feito sem login; aprovação na área admin exige identidade confirmada independentemente. Não há reivindicação automática por telefone. Ler `docs/GUEST_HISTORY_LINKING.md`.

## Integração segura à main (não é deploy)
- `npm run release:gate` integra verificação de configurações de exclusão, rules e testes no CI.
- `npm test` inclui suites comerciais; limite manual de equipe validado por função testada.
- Varredura operacional de capacidade `/api/platform/media/inventory/scan` classifica bytes observados por tenant; não fornece custos, fatura ou egress.
- A integração de código na main é permitida somente após CI verde e revisão. Habilitação de produção continua bloqueada por IAM, GCS staging, medição de custos/egress e QA físico.
