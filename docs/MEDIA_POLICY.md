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
- Inventário da página de Storage (100 itens no máximo) disponibiliza tamanho, geração e classe de mídia apenas para Platform Owner. Não equivale a quota, fatura ou egress. Ainda sem monitoramento global de custo/egress, reserva de capacidade ou saneamento retroativo de legados.
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
- Estados: `pending_review` → `approved_pending_manual_removal` **ou** `rejected`. Aprovação não apaga arquivos; o Platform Owner precisa executar separadamente `execute` com confirmação, geração e opt-in. Execução registra `deletion_in_progress` → `deleted_verified` apenas após ausência confirmada no Storage, com recuperação de interrupções.
- Fotos existentes são imutáveis nas Storage Rules. Exclusão física é exceção via Worker confiável com `MEDIA_DELETION_ENABLED=true` (desligado por padrão), permissão Platform Owner, aprovação prévia, geração exata e precondição `ifGenerationMatch`. Apenas arquivos com proveniência `PERSISTENT_BUSINESS` e `metadataPolicy=reencoded_no_exif` podem ser removidos por esse fluxo; legacy negado.
- Para questões urgentes de privacidade, uma aprovação não bloqueia URLs. Mesmo `deleted_verified` só comprova ausência do objeto no Storage naquele instante; caches, URLs externas, backups e direitos LGPD completos exigem validações próprias.

## Operação de revisão
1. Verificar identidade/solicitação e finalidade/obrigações de retenção; `UNKNOWN_LEGACY` nunca recebe exclusão automática.
2. Confirmar o tenant e o caminho exato da mídia, consentimentos e eventual reserva legal.
3. Registrar aprovação ou rejeição com motivo; salvar evidência na trilha auditável.
4. Se aprovado, inspecionar inventário e geração no `/platform`, habilitar temporariamente o Worker apenas em staging autorizado, confirmar execução explícita com motivo, `ifGenerationMatch` e verificar ausência real e audit log. A execução está automatizada no código e passou no Storage Emulator; produção não foi habilitada.
5. O Worker grava `deleted_verified` e audit log somente após o provedor retornar objeto ausente; conferir evidências, URLs/caches/backups e obrigações legais separadamente.

**Limitações ainda abertas:** inventário/medição integral, custos e egress, validação GCS staging/IAM, propagação de links/caches, LGPD ponta a ponta, legados e QA real. Nenhuma retenção genérica/TTL foi ativada. Consulte `docs/STORAGE_DELETION_RUNBOOK.md`.

## Observabilidade parcial de capacidade
O endpoint `/api/platform/media/inventory` retorna bytes e classificação por **página consultada** em `metrics` e o painel soma somente páginas carregadas. Tipos legados são explicitamente identificados. Isso NÃO mede egress, custos reais, tarifas do Firebase ou quota de serviços. Não criar limites comerciais fictícios; ainda faltam métricas do provedor e alertas reais.

## Inventário operacional (sem inventar fatura)
`POST /api/platform/media/inventory/scan` (Platform Owner) recebe tenantId, `maxPages` de 1 a 20, cursor opcional e `alertThresholdBytes` opcional. Retorna contagem e bytes das páginas efetivamente varridas, separados em `PERSISTENT_BUSINESS`, `UNKNOWN_LEGACY` e outros; pode continuar pelo cursor. O limiar sinaliza SOMENTE se os bytes já observados o excederam. Resultado abaixo do limiar com páginas pendentes não comprova consumo seguro. NÃO é egress, Cloud Billing ou alerta por custo real. O frontend expõe varredura de até 10 páginas e limiar operacional em MiB.
