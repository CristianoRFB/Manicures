# STORAGE_DELETION_RUNBOOK — Manicure

Estado: **código implementado, NÃO habilitado nem homologado em produção**. Protocolo subordinado a `docs/MEDIA_POLICY.md` e ao padrão global de ciclo de vida de mídia do ecossistema. Não é cobrança/quota de plano.

## Salvaguardas implementadas
- `MEDIA_DELETION_ENABLED` não existe por padrão no deploy e exige valor literal `true` para usar `POST /api/platform/media/removal/execute`.
- `FIREBASE_STORAGE_BUCKET` é obrigatório e deve apontar EXATAMENTE para o bucket correto do ambiente. Hosts do Emulator só podem ser loopback e projeto sintético.
- Somente Platform Owner autenticado via Firebase ID token; nenhuma permissão de delete nas Storage Rules para navegador, tenant owner ou admin.
- Solicitação deve existir em `tenants/{tenantId}/mediaRemovalRequests/{requestId}`, com revisão anterior `approved_pending_manual_removal`.
- Cliente precisa confirmar literal `REMOVER_MIDIA_APROVADA`, motivo (10–500 caracteres) e a `expectedGeneration` observada no inventário. Não são aceitos caminhos arbitrários, arquivos de outros tenants ou registros não aprovados.
- Geração e metadados vêm do Storage, e não do formulário. Só podem ser excluídos arquivos `PERSISTENT_BUSINESS` com `metadataPolicy=reencoded_no_exif` reconhecidos; `UNKNOWN_LEGACY` é bloqueado para avaliação específica.
- Antes do DELETE: transação Firestore com CAS muda `approved_pending_manual_removal` → `deletion_in_progress`, registrando identidade, geração e tamanho.
- DELETE pela API de Storage tem `ifGenerationMatch`. Em seguida o Worker exige GET 404 para constatar ausência. Só então grava `deleted_verified` e um audit log atômico.
- Se o Worker falhar entre DELETE e confirmação, o estado permanece `deletion_in_progress`: a repetição autorizada valida a geração e a ausência no provedor antes de finalizar. Não há deleção por fila automática/TTL.
- Inventário paginado (até 100 objetos por página) exige Platform Owner, reporta apenas contagem e bytes da página, NÃO mede saída de dados, custo, limites contratados ou uso total.

## Fluxo operacional recomendado
1. Homologar em staging com dados fictícios, projeto Firebase separado e bucket de staging. Testar 403, 409, 503, objeto ausente, geração alterada, paralelismo e retomada após interrupção. Conferir Service Account IAM para Firestore e apenas as permissões necessárias de leitura/listagem/deleção de objetos.
2. Revisar legitimidade da solicitação, direitos de titulares, eventuais obrigações legais de retenção e backups. Confirmar que a imagem é do tenant correto. Não equiparar consentimento do owner à autorização jurídica suficiente em qualquer circunstância.
3. Usar `/platform` para consultar o inventário; identificar nome exato, geração e `mediaClass`. Validar o pedido, revisão anterior e motivo.
4. Autorizar explicitamente `MEDIA_DELETION_ENABLED=true` apenas no ambiente/tempo aprovado. Requer ação operacional externa de quem administra o deployment. Nunca versionar segredos/credenciais ou habilitar automaticamente.
5. Informar o literal de confirmação e um motivo. Executar uma única remoção aprovada. Conferir `deleted_verified` e audit logs. Se falhar, não inferir sucesso a partir de erro HTTP: conferir ledger e Storage antes de repetir.
6. Validar links públicos e URLs com tokens antigos, cache CDN e eventuais backups. Uma verificação de ausência do objeto **não comprova purga de caches/cópias externas**, nem cumprimento integral de requisitos legais.
7. Desabilitar `MEDIA_DELETION_ENABLED` novamente e guardar evidências auditáveis de revisão e execução.

## API
`POST /api/platform/media/inventory`
```json
{"tenantId":"a","pageToken":"<somente quando retornado pela página anterior>"}
```
Resposta inclui `objects`, `generation`, `size`, `nextPageToken` e `exhaustive`.

`POST /api/platform/media/removal/execute`
```json
{"tenantId":"a","requestId":"UUID-DO-PEDIDO","expectedGeneration":"123456","confirmation":"REMOVER_MIDIA_APROVADA","reason":"Motivo autorizado e registrado para exclusão"}
```
**Não há ambiente de produção com isso habilitado nesta etapa.** Os resultados em testes simulados NÃO demonstram integração real com Cloud Storage em deploy.

## Pendências remanescentes
- Fluxo físico já testado no Firebase Storage Emulator com arquivo fictício: upload, aprovação, exclusão por geração, ausência verificada e tombstone. **Staging GCS e IAM real seguem pendentes.** Testes simulados adicionais cobrem geração errada, mídia legacy, interrupção e retomada.
- Controle de inventário completo e reconciliação com quota/custos/egress; a página limitada é apenas insumo.
- Revogação/propagação de URLs, caches externos, backups e LGPD ponta a ponta.
- Registros LEGACY/UNKNOWN tratados em plano separado sem exclusão oportunista.
- QA visual desktop/mobile, screenshots REAIS e deploy staging.
