# DEMO-ACCEPTANCE — Manicures V7 / Studio Íris
Data: 2026-11-18. Ambiente: Worker independente em https://77-manicures-v7-studio-iris-preview.on7.workers.dev/ (sem ligação com dados reais).

## Ciclo 1 — Produto/funcionalidade
- PASSOU: repositório original `CristianoRFB/Manicures` identificado; `main` não modificada; sistema original não está em produção segundo `docs/STATUS.md`.
- PASSOU: home / comercial, slogan literal, CTAs reais e ambas tabelas ✅/❌. Preço literal com ressalva contratual.
- PASSOU: /cliente e /gestao acessíveis por URL direta; verificados por extração externa e navegador remoto.
- PASSOU: gestão editou preço fictício do serviço de R$95 para R$123; armazenamento salvo e painel atualizado, verificação Cloudflare Browser Rendering DOM.
- PASSOU: a vitrine refletiu preço de R$123 ao atualizar o estado do mesmo navegador, testado por evento storage e inspeção DOM.
- PASSOU: formulário de pedido criou agendamento de exemplo com status pendente e comprovante visual; horário ocupado sumiu.
- PASSOU: gestão criou e excluiu serviço fictício e rejeitou formulário inválido (Browser Rendering DOM).
- PASSOU: imagens ilustrativas com fonte Unsplash, sem logotipo oficial ou dados do lead.
- LIMITAÇÃO TRANSPARENTE: testes isolados em contexto headless; os dados são localStorage, não há sincronização entre clientes, login, reserva real, backend nem pagamentos.

## Ciclo 2 — Visual e conversão
- PASSOU: captura real do hero em 390×844 mostrando headline, slogan e ambos CTAs.
- PASSOU: captura real de /cliente em 390×844 com foto carregada e hierarquia mobile.
- PASSOU: captura real da gestão em 1440×900; painel com estado vazio e CTAs úteis.
- PASSOU: / em 320×780 sem scroll lateral, imagem carregada, ambos CTAs presentes.
- FALHA CORRIGIDA: no mobile, formulário vinha antes da lista de serviços; invertida a ordem para mostrar primeiro o catálogo.
- RETESTADO: /cliente em 320×740, sem overflow, 4 serviços listados antes do agendamento, 4 slots, CTA funcional.
- Teste de automação externo TinyFish indisponível por saldo, substituído por execução real do navegador no Cloudflare Browser Rendering.
- NÃO TESTADO: dispositivos físicos e acessibilidade por leitor de tela; esta demo conceitual NÃO substitui homologação do sistema original.

## Publicação
- Worker: `77-manicures-v7-studio-iris-preview`.
- Conta: destino Cloudflare autorizado e isolado; `workers.dev` habilitado.
- Rota raiz e /cliente /gestao servidas pelo Worker; carga HTML conferida e screenshots obtidos após publicação.
- Branch apenas: `demo/v7-manicures-studio-iris-20261118`.
- Produção e base canônica: sem alteração.
