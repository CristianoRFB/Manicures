# MEDIA_POLICY — Manicure

**Estado:** implementação VERTICAL parcial; ciclo de vida seguro para mídia PERSISTENT_BUSINESS, não uma biblioteca global.
**Fonte:** 77_SAAS_GLOBAL_MEDIA_LIFECYCLE_STANDARD_v01; não altera preços, planos ou limites comerciais aprovados.

## Mídia existente
- Fotos reais enviadas por tenant_owner/tenant_admin são armazenadas em `tenants/{tenantId}/public/portfolio/{uuid}.{jpg|png|webp}`.
- Cada objeto é rotulado `mediaClass=PERSISTENT_BUSINESS`, `policyVersion=1`, `source=studio_admin`.
- Não existem jobs de TTL nem exclusão automática para esse portfólio; conteúdo fica preservado até fluxo autorizado específico de descarte/atualização.
- Upload de browser aceita JPEG, PNG ou WebP de 1 byte a 5 MiB. **Esse limite é de segurança por objeto, não é quota comercial**.
- `storage.rules` aplica separação: `public` legível se tenant ativo; `private` apenas gestão; `professionals/{id}` pelo profissional correspondente ou gestão; `customers/{id}` pelo cliente correspondente ou gestão. Outros tenants não podem acessar. Nenhum caminho de delete pelo cliente.
- Fotos da galeria são reais publicadas; nenhuma screenshot de tela, visual conceitual ou imagem gerada é tratada como fotografia do serviço.

## Restrições e trabalho posterior
- Sem metering de bytes por tenant nem monitoramento de custo/egress, versão de mídia, reserva de capacidade, EXIF stripping, política LGPD de remoção sob solicitação ou workflow de publicação/revisão.
- Não anunciar "armazenamento ilimitado" nem prometer operação gratuita indefinida do Firebase. Bloquear uploads em incidentes de capacidade depende de infraestrutura futura aprovada.
- Não inferir quotas globais dos limites pontuais de upload. Mídia `UNKNOWN_LEGACY` não deve ser excluída automaticamente.
- Não expor arquivos privados em links públicos de download ou logs. Nunca usar mockups como screenshots reais.
- Testes de regras: `src/test/storage.rules.test.ts` no Storage Emulator junto a Auth/Firestore; `npm run test:emulator`.

## Prova antes de publicar produção
Homologar e medir em ambiente seguro: formato real e capacidade, links públicos, upload web/mobile, acesso A/B, permissões de clientes/profissionais, egress, alertas de quota, privacidade/EXIF, logs e fluxo de revogação LGPD. Não foi feito deploy nem teste real de navegador nesta etapa.
