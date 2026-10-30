# MEDIA_POLICY — Manicure

**Estado:** implementação VERTICAL parcial; ciclo de vida seguro para mídia PERSISTENT_BUSINESS, não uma biblioteca global.
**Fonte:** 77_SAAS_GLOBAL_MEDIA_LIFECYCLE_STANDARD_v01; não altera preços, planos ou limites comerciais aprovados.

## Mídia existente
- Fotos reais enviadas por tenant_owner/tenant_admin são armazenadas em `tenants/{tenantId}/public/portfolio/{uuid}.webp` para novos uploads (formatos históricos anteriores são preservados).
- Novos objetos são rotulados `mediaClass=PERSISTENT_BUSINESS`, `policyVersion=1`, `source=studio_admin`, `metadataPolicy=reencoded_no_exif`.
- Não existem jobs de TTL nem exclusão automática para esse portfólio; conteúdo fica preservado até fluxo autorizado específico de descarte/atualização.
- Galeria pública carrega no máximo 12 imagens por página com botão explícito para continuar, reduzindo enumeração de URLs e transferência desnecessária.
- Upload de browser aceita JPEG, PNG ou WebP de 1 byte a 5 MiB; o arquivo é redimensionado a até 1920 px na maior dimensão, recodificado em WebP, removendo os metadados originais embutidos. **Esses limites são de segurança por objeto, não quotas comerciais**.
- `storage.rules` aplica separação: `public` legível se tenant ativo; `private` apenas gestão; `professionals/{id}` pelo profissional correspondente ou gestão; `customers/{id}` pelo cliente correspondente ou gestão. Outros tenants não podem acessar. Nenhum caminho de delete pelo cliente.
- Fotos da galeria são reais publicadas; nenhuma screenshot de tela, visual conceitual ou imagem gerada é tratada como fotografia do serviço.

## Restrições e trabalho posterior
- Sem metering consolidado de bytes por tenant nem monitoramento de custo/egress, versão de mídia, reserva de capacidade, saneamento retroativo de metadados em arquivos legados, política LGPD de remoção sob solicitação ou workflow de publicação/revisão.
- Não anunciar "armazenamento ilimitado" nem prometer operação gratuita indefinida do Firebase. Uma pausa emergencial de novos uploads pode ser acionada pelo Platform Owner via `/api/platform/media/pause`, com auditoria e CAS; `storage.rules` aplica `mediaUploadsPaused`, preservando leituras, demais tenants e imagens existentes. Isso NÃO mede egress nem gerencia limpeza.
- Não inferir quotas globais dos limites pontuais de upload. Mídia `UNKNOWN_LEGACY` não deve ser excluída automaticamente.
- Não expor arquivos privados em links públicos de download ou logs. Nunca usar mockups como screenshots reais.
- Testes de regras: `src/test/storage.rules.test.ts` no Storage Emulator junto a Auth/Firestore; `npm run test:emulator`.

## Prova antes de publicar produção
Homologar e medir em ambiente seguro: formato real e capacidade, links públicos, upload web/mobile, acesso A/B, permissões de clientes/profissionais, egress, alertas de quota, privacidade/EXIF, logs e fluxo de revogação LGPD. Não foi feito deploy nem teste real de navegador nesta etapa.

## Solicitação de remoção de portfólio — etapa implementada
- Proprietário, administrador do tenant ou Platform Owner abre `POST /api/media/removal/request` com `tenantId`, `objectPath` validado dentro de `tenants/{tenantId}/public/portfolio/` e motivo entre 10 e 500 caracteres.
- O Worker registra `mediaRemovalRequests/{requestId}` e `auditLogs` atomicamente. Motivo e detalhes do solicitante não ficam disponíveis por leitura direta nas Firestore Rules.
- O solicitante pode acompanhar via `POST /api/media/removal/list`, somente com membership autorizada. O Platform Owner revisa pela UI `/platform` usando `POST /api/platform/media/removal/review`, com justificativa e controle CAS.
- Estados: `pending_review` → `approved_pending_manual_removal` **ou** `rejected`. Uma aprovação **não** faz delete físico nem revoga URL/token de download, nem representa LGPD concluída. Há pendência de execução autorizada, prova do provedor e tombstone final.
- Fotos existentes são imutáveis pelas Storage Rules: novos uploads permitidos somente com `resource == null`; `update` e `delete` negados para clientes, proprietários e admins via SDK. Exclusão física futura exige ferramenta privilegiada e aprovação específica, com evidência.
- Para questões urgentes de privacidade, a simples aprovação do pedido não basta para impedir visualizações ou URLs antigas. **Não declarar remediação concluída sem remoção/revogação real.**

## Operação de revisão
1. Verificar identidade/solicitação e finalidade/obrigações de retenção; `UNKNOWN_LEGACY` nunca recebe exclusão automática.
2. Confirmar o tenant e o caminho exato da mídia, consentimentos e eventual reserva legal.
3. Registrar aprovação ou rejeição com motivo; salvar evidência na trilha auditável.
4. Se aprovado, executar procedimento físico com credencial administrativa autorizada, conferência de geração/hash e estado do objeto, confirmação do provedor e revogação de URLs conforme aplicável. **Esse passo não está automatizado nesta entrega.**
5. Só após comprovação externa, registrar encerramento em um futuro fluxo de finalização/tombstone auditado, nunca pela alegação do usuário.

**Limitações ainda abertas:** inventário/medição reconciliados com Storage, custos e egress, remoção/revogação física com retries e idempotência, LGPD ponta a ponta, tratamento de legados, QA real. Nenhuma retenção genérica/TTL foi ativada.
