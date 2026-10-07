# PADRÃO GLOBAL — DOCS + LEADS + IMAGENS GERADAS

## Objetivo real

Este padrão existe para garantir que cada sistema/SaaS não tenha só código.

Cada projeto deve deixar em `docs/` um pacote visual e técnico completo, incluindo:

- screenshots reais do sistema;
- diagramas técnicos;
- estrutura de Firebase/arquitetura;
- imagens geradas criativamente de como o sistema pode ficar;
- material visual adaptado ao lead/cliente quando houver análise de lead.

A ideia é que o projeto fique útil para:

- desenvolvimento;
- revisão;
- apresentação;
- venda;
- personalização por lead;
- geração de demo futura.

---

# 1. Regra central

Dentro de `docs/`, o projeto deve ter **três camadas visuais**:

## A. Prova real
Material que mostra o que já existe de verdade.

Exemplos:
- screenshots reais;
- telas reais;
- diagrama do que já foi implementado;
- estrutura real do Firebase;
- estrutura real do projeto.

## B. Visão de produto
Material que mostra como o sistema é imaginado de forma mais criativa e organizada.

Exemplos:
- concept screens;
- mockups;
- telas idealizadas;
- painéis conceituais;
- identidade visual sugerida;
- versões bonitas de fluxo/admin/app.

## C. Material por lead
Material adaptado a um possível cliente/lead específico.

Exemplos:
- referências extraídas do Instagram;
- identidade visual percebida do lead;
- proposta visual adaptada;
- imagens geradas inspiradas no cliente;
- sugestões de landing/demo personalizadas.

---

# 2. Estrutura padrão de docs

```text
docs/
├── CURRENT.md
├── DIAGRAMS_MANIFEST.md
├── LEADS_MANIFEST.md
│
└── versions/
    └── <versao-atual>/
        ├── README.md
        ├── STATUS.md
        ├── ARCHITECTURE.md
        ├── DATA_MODEL.md
        ├── SECURITY.md
        ├── FIREBASE_STRUCTURE.md
        ├── PROJECT_STRUCTURE.md
        ├── SCREENS.md
        ├── GENERATED_VISUALS.md
        ├── LEADS_OVERVIEW.md
        │
        ├── diagrams/
        │   ├── source/
        │   └── rendered/
        │
        ├── screenshots/
        │
        ├── generated/
        │   ├── concepts/
        │   ├── mockups/
        │   ├── lead-adapted/
        │   └── covers/
        │
        └── leads/
            ├── <lead-slug-01>/
            │   ├── LEAD_CONTEXT.md
            │   ├── LEAD_REFERENCE_SUMMARY.md
            │   ├── LEAD_VISUAL_DIRECTION.md
            │   ├── assets/
            │   ├── captures/
            │   └── generated/
            │
            └── <lead-slug-02>/
```

---

# 3. O que obrigatoriamente deve existir

## 3.1 Screenshots reais

Em:

```text
docs/versions/<versao>/screenshots/
```

Devem existir screenshots reais do sistema quando o sistema for executável.

Prioridade:
- login;
- dashboard;
- fluxo principal;
- admin;
- tela pública;
- tela do cliente;
- tela do entregador, quando houver;
- Platform Owner, quando houver.

Essas imagens são prova de implementação.

---

## 3.2 Diagramas

Em:

```text
docs/versions/<versao>/diagrams/
```

Devem existir diagramas técnicos do estado atual.

Preferência:
- Mermaid como fonte editável;
- SVG como render final.

Conjunto padrão quando aplicável:
- system context;
- multitenant architecture;
- firebase data model;
- auth/rbac;
- core flow;
- deployment.

Esses diagramas representam o sistema real.

---

## 3.3 Imagens geradas do sistema

Em:

```text
docs/versions/<versao>/generated/
```

Aqui entram imagens geradas criativamente.

Essas imagens NÃO são prova de implementação.
Elas são visão de produto/apresentação.

Devem ser usadas para:
- imaginar a cara final do sistema;
- gerar visão mais bonita;
- apresentar ideias;
- servir de referência para UI futura;
- ajudar na venda do projeto.

Subpastas recomendadas:

```text
generated/
├── concepts/
├── mockups/
├── lead-adapted/
└── covers/
```

### concepts
Imagens conceituais do sistema em geral.

Exemplos:
- dashboard idealizado;
- app mobile idealizado;
- tela de admin idealizada;
- hero/landing do produto;
- visão “premium” do sistema.

### mockups
Mockups mais objetivos de telas ou conjuntos de telas.

### lead-adapted
Imagens geradas adaptadas a um lead específico.

### covers
Imagens de capa, thumbnails, cards de apresentação.

---

# 4. GENERATED_VISUALS.md

Criar:

```text
docs/versions/<versao>/GENERATED_VISUALS.md
```

Esse arquivo deve listar todas as imagens geradas.

Para cada imagem, registrar:
- nome;
- tipo (`concept`, `mockup`, `lead-adapted`, `cover`);
- objetivo;
- se representa estado real ou idealizado;
- qual lead inspirou a peça, se houver;
- caminho do arquivo.

Exemplo de tabela:

| Arquivo | Tipo | Objetivo | Base | Observação |
|---|---|---|---|---|
| `generated/concepts/admin-dashboard-v1.png` | concept | visão do admin | sistema geral | idealizado |
| `generated/lead-adapted/anime-fest-home-v1.png` | lead-adapted | proposta para lead | Instagram do lead | adaptado |
| `generated/covers/product-overview.png` | cover | apresentação | sistema geral | comercial |

Regra:
sempre deixar claro o que é real e o que é conceitual.

---

# 5. Protocolo de lead

Quando eu pedir para o chat atualizar ou analisar um lead, ele deve fazer bem mais do que só resumir texto.

Ele deve gerar um pacote por lead em:

```text
docs/versions/<versao>/leads/<lead-slug>/
```

Esse pacote deve conter:

## 5.1 LEAD_CONTEXT.md

Resumo do lead:
- nome;
- nicho;
- cidade/região, se houver;
- links;
- origem da análise;
- nível de confiança;
- observações importantes.

## 5.2 LEAD_REFERENCE_SUMMARY.md

Resumo do que foi observado no material do lead:
- bio;
- links;
- branding;
- cores;
- tipo de conteúdo;
- estilo visual;
- público aparente;
- produtos/serviços;
- pontos fortes;
- gaps percebidos;
- oportunidades de sistema/site.

## 5.3 LEAD_VISUAL_DIRECTION.md

Direção visual proposta:
- paleta sugerida;
- estilo geral;
- tom do site/sistema;
- referências;
- abordagem de layout;
- o que deve parecer premium/profissional/divertido etc.;
- quais elementos do lead devem inspirar a demo.

---

# 6. Capturas do lead

Dentro de cada lead:

```text
captures/
assets/
```

## captures
Material bruto coletado:
- prints;
- screenshots;
- grids;
- recortes;
- arquivos de referência.

## assets
Versões organizadas:
- logo extraído;
- banner;
- avatar;
- referências de cor;
- peças úteis para branding.

---

# 7. Imagens geradas por lead

Dentro de:

```text
docs/versions/<versao>/leads/<lead-slug>/generated/
```

O chat deve gerar, quando fizer sentido, imagens como:

- home/landing inspirada no lead;
- dashboard/admin adaptado ao branding do lead;
- mockup mobile do sistema;
- cardápio/reserva/agendamento adaptado ao nicho;
- banner conceitual;
- tela inicial conceitual;
- proposta visual geral.

Essas imagens servem para:
- vender ideia;
- guiar design;
- criar demo futura;
- mostrar potencial personalizado.

---

# 8. Quando gerar imagem para lead

Sempre que eu pedir algo como:
- “analisa esse Instagram”;
- “atualiza esse lead”;
- “pega as informações desse lead”;
- “gera contexto desse lead”;
- “faz uma proposta pra esse cliente”;

o fluxo ideal deve ser:

```text
capturar referências
→ resumir contexto
→ identificar branding/estilo
→ sugerir solução digital
→ gerar imagens conceituais
→ salvar tudo em docs/leads/<lead-slug>/
```

Ou seja:
**lead novo = contexto + referência + imagem gerada + proposta visual**.

Não deve parar só no texto.

---

# 9. Tipos de imagens que devem ser geradas

## Para o sistema geral
- visão de dashboard;
- painel admin;
- app mobile;
- tela pública;
- tela de operação;
- landing do produto.

## Para o lead
- landing adaptada;
- homepage adaptada;
- UI com branding do lead;
- proposta de sistema adaptada;
- composição visual de demo.

## Para apresentação
- capa do projeto;
- overview visual;
- collage de telas;
- card de proposta.

---

# 10. Diferença entre screenshot e imagem gerada

## Screenshot
- mostra o que existe;
- é prova;
- deve vir do sistema real.

## Imagem gerada
- mostra visão;
- é conceitual;
- pode ser usada para design, proposta e venda.

Os dois devem coexistir no projeto.

Não misturar.
Não vender mockup como se fosse feature implementada.

---

# 11. LEADS_OVERVIEW.md

Criar também:

```text
docs/versions/<versao>/LEADS_OVERVIEW.md
```

Esse arquivo consolida os leads daquele projeto.

Cada lead deve registrar:
- nome;
- slug;
- data de análise;
- nicho;
- fonte;
- status;
- existe imagem gerada? sim/não;
- existe proposta visual? sim/não;
- caminho da pasta.

Exemplo:

| Lead | Slug | Nicho | Fonte | Status | Imagens geradas |
|---|---|---|---|---|---|
| Anime Fest RP | anime-fest-rp | evento/anime | Instagram | analisado | sim |
| Zé Cosmaker | ze-cosmaker | cosplay | Instagram/Linktree | analisado | sim |

---

# 12. LEADS_MANIFEST.md

Criar:

```text
docs/LEADS_MANIFEST.md
```

Esse manifesto geral existe para o projeto inteiro.

Ele deve indicar:
- quais leads já foram analisados;
- em qual versão foram adicionados;
- se possuem material visual;
- se possuem proposta gerada;
- se viraram demo;
- se viraram cliente real.

---

# 13. Critério mínimo quando eu mandar “atualizar lead”

Quando eu pedir para atualizar um lead, o resultado ideal deve incluir:

- contexto textual atualizado;
- observações de branding/visual;
- oportunidade de site/sistema;
- pasta do lead criada/atualizada;
- material de referência salvo;
- pelo menos 1 imagem gerada de proposta visual quando fizer sentido;
- atualização do `LEADS_OVERVIEW.md`;
- atualização do `LEADS_MANIFEST.md`.

Se não der para gerar imagem naquele momento, isso precisa ficar explícito.

Mas a regra padrão é: **lead importante deve ter imagem gerada**.

---

# 14. scripts de conferência

Além de `docs:check`, o projeto pode ter algo como:

```text
npm run docs:check
npm run docs:diagrams
npm run docs:leads
```

## docs:check
Verifica docs principais.

## docs:diagrams
Renderiza Mermaid.

## docs:leads
Confere:
- se leads listados existem;
- se manifesto está consistente;
- se pastas de lead existem;
- se caminhos referenciados em markdown existem;
- se `generated/` e `captures/` estão coerentes.

---

# 15. Critério de aceite atualizado

Um projeto fica visualmente/documentalmente bem montado quando tem:

- código;
- docs técnicos;
- Firebase documentado;
- screenshots reais;
- diagramas editáveis/renderizados;
- imagens geradas de conceito;
- estrutura de leads;
- proposta visual por lead quando aplicável.

Ou seja, o padrão completo é:

```text
CÓDIGO
+ DOCS
+ DIAGRAMAS
+ SCREENSHOTS
+ IMAGENS GERADAS
+ LEADS ORGANIZADOS
```

---

# 16. Regra final para os próximos prompts/GOALs

Todo próximo prompt de atualização estrutural pode exigir, no final:

```text
DOCUMENTAÇÃO CANÔNICA + SCREENSHOTS + DIAGRAMAS + IMAGENS GERADAS + LEADS
```

E isso significa:

```text
implementar
→ testar
→ documentar
→ capturar screenshots reais
→ gerar diagramas
→ gerar imagens conceituais
→ organizar pasta de lead quando houver
→ atualizar manifestos
```

---

# 17. Resumo curto

O que eu quero dentro de `docs/` não é só texto técnico.

Eu quero:

- **screenshots reais** do sistema;
- **diagramas** do sistema;
- **imagens geradas criativamente** de como ele pode ficar;
- **material por lead**, inclusive referência e imagem adaptada ao cliente.

Esse é o padrão.
