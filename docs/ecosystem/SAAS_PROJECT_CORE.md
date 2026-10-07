# SaaS Project Core — Fonte Central do Ecossistema

> **Status:** ATIVO  
> **Versão:** v01  
> **Função:** Fonte central de decisões compartilhadas entre os SaaS deste Project.

---

## 1. Objetivo

Este arquivo existe para evitar que cada chat de SaaS vire uma ilha.

O Project possui vários produtos independentes, como SaaS de alimentação, dentista, manicure, banca, caravana, cosmaker e outros. Cada produto continua com seu próprio domínio, código e regras específicas, mas decisões que podem afetar vários SaaS devem ser registradas primeiro aqui.

A regra principal é:

> **Uma novidade entra primeiro no Core. Depois decidimos quais SaaS ela realmente afeta.**

Isso evita copiar a mesma ideia manualmente para todos os chats e reduz o risco de cada produto evoluir com padrões diferentes sem necessidade.

---

## 2. Como classificar qualquer nova ideia

Toda nova descoberta, referência, recurso ou padrão deve ser classificado em um destes três níveis antes de ser implementado.

### GLOBAL

Vale para praticamente todo o ecossistema.

Exemplos:

- padrão de landing page;
- apresentação comercial do produto;
- Platform Owner;
- Multi-Tenant;
- White-Label;
- memberships;
- audit logs;
- documentação versionada;
- segurança;
- acessibilidade;
- responsividade;
- onboarding;
- padrões de UX;
- estrutura de pricing/planos;
- screenshots reais como evidência de implementação.

### VERTICAL

Vale apenas para uma família de SaaS.

Exemplos:

**Alimentação**
- cardápio online;
- QR Code;
- pedidos;
- retirada;
- mesa;
- delivery;
- motoboy.

Pode afetar:
- SaaS Açaí;
- SaaS Sorveteria;
- SaaS Sushi;
- SaaS Food.

**Agendamento**
- agenda;
- disponibilidade;
- bloqueios;
- prevenção de conflito;
- lembretes.

Pode afetar:
- SaaS Dentista;
- SaaS Manicure;
- outros produtos que realmente trabalhem com agenda.

### LOCAL

Vale somente para um produto.

Exemplos:

**Dentista**
- odontograma;
- prontuário;
- plano de tratamento.

**Manicure**
- alongamento;
- manutenção;
- nail art.

**Açaí**
- monte seu copo;
- complementos específicos.

**Sushi**
- peças;
- combinados;
- temaki.

Uma regra local não deve virar padrão global só porque apareceu em um projeto.

---

## 3. Fluxo obrigatório para novas ideias

Quando surgir uma nova ideia ou referência:

1. registrar a ideia neste Core;
2. classificar como `GLOBAL`, `VERTICAL` ou `LOCAL`;
3. identificar quais SaaS são afetados;
4. identificar quais SaaS NÃO são afetados;
5. classificar o tipo de mudança:
   - arquitetura;
   - backend;
   - banco;
   - autenticação;
   - segurança;
   - UX/UI;
   - landing page;
   - comercial;
   - documentação;
   - feature;
6. decidir prioridade:
   - NOW;
   - NEXT;
   - DEFERRED;
7. verificar dependências;
8. somente depois gerar o prompt/goal para os produtos afetados.

Não interromper uma migração ou refatoração crítica para implementar imediatamente uma novidade de baixa prioridade.

---

## 4. Regra de implementação

Uma decisão registrada aqui **não significa implementação imediata**.

Exemplo:

Uma nova ideia de cardápio online pode ser registrada agora, mas se o SaaS ainda estiver no meio da conversão Multi-Tenant, a prioridade continua sendo terminar:

- isolamento;
- tenant resolver;
- RBAC;
- Security Rules;
- Platform Admin;
- migração;
- testes.

A feature nova entra no roadmap e recebe um goal próprio posteriormente.

Regra:

> **Registrar cedo. Implementar na hora certa.**

---

## 5. Matriz de impacto

Manter atualizada uma matriz conceitual como esta:

| Padrão / Feature | Açaí | Sorvete | Sushi | Food | Dentista | Manicure | Banca | Cosmaker | Caravana |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Multi-Tenant White-Label | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform Owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit Logs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Padrão de landing SaaS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cardápio Online | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delivery | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Agenda | conforme produto | conforme produto | conforme produto | conforme produto | ✅ | ✅ | conforme produto | conforme produto | conforme produto |
| Prontuário | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

A matriz deve evoluir conforme novos SaaS forem criados.

---

## 6. Changelog global

Toda mudança compartilhada relevante deve ser registrada.

Formato recomendado:

```md
## [GLOBAL-v02] Novo padrão de landing page

Data:
Status: PLANNED / ACTIVE / DEPRECATED

Escopo:
GLOBAL

Tipo:
UX/UI + COMERCIAL

Motivo:
Melhorar apresentação e conversão dos produtos SaaS.

Afeta:
- Dentista
- Manicure
- Açaí
- Sorveteria
- Sushi
- Food
- Banca
- Cosmaker
- Caravana

Não altera:
- autenticação;
- banco;
- isolamento;
- regras de negócio específicas.

Prioridade:
NEXT
```

---

## 7. Versionamento de padrões

Este Core possui versão própria.

Exemplo:

- `GLOBAL-v01`
- `GLOBAL-v02`
- `GLOBAL-v03`

Uma nova versão deve ser criada quando houver mudança relevante em padrões compartilhados.

Correções pequenas de texto não exigem nova versão.

Cada SaaS pode registrar quais padrões já incorporou.

Exemplo:

```txt
GLOBAL_STANDARD=GLOBAL-v03
VERTICAL_STANDARD=APPOINTMENT-v02
PRODUCT_STANDARD=DENTIST-v04
```

Isso permite descobrir quais produtos estão desatualizados.

---

## 8. Relação com os chats especialistas

Cada chat especialista continua responsável pelo seu próprio produto.

Exemplos:

- SaaS Dentista;
- SaaS Manicure;
- SaaS Açaí;
- SaaS Sorveteria;
- SaaS Sushi;
- SaaS Food;
- SaaS Banca;
- SaaS Cosmaker;
- SaaS Caravana.

Os chats especialistas devem:

1. respeitar o Core vigente;
2. manter decisões específicas do próprio domínio;
3. não sobrescrever silenciosamente regras globais;
4. avisar quando uma regra global não fizer sentido naquele produto;
5. propor exceção local quando necessário;
6. informar quando uma descoberta local parece útil para outros SaaS.

---

## 9. Regra de conflito

Se uma decisão local entrar em conflito com o Core:

1. identificar explicitamente o conflito;
2. não alterar a arquitetura silenciosamente;
3. decidir se:
   - o produto precisa de uma exceção local; ou
   - o padrão global ficou desatualizado e deve evoluir;
4. registrar a decisão.

Especialização do domínio pode justificar exceções.

O objetivo não é forçar todos os SaaS a terem a mesma arquitetura interna.

---

## 10. Regra arquitetural do ecossistema

Os SaaS NÃO devem ser fundidos em uma única base apenas porque compartilham alguns padrões.

Princípio:

> **Multi-Tenant dentro de cada vertical. Integração entre verticais somente quando houver necessidade real.**

E também:

> **Genérico onde realmente é comum; especializado onde o negócio é diferente.**

Exemplo de alimentação:

- SaaS Açaí permanece separado;
- SaaS Sorveteria permanece separado;
- SaaS Sushi permanece separado;
- SaaS Food agrupa apenas negócios alimentícios suficientemente compatíveis;
- Delivery pode futuramente ser um serviço transversal;
- marketplace continua sendo possibilidade futura, não prioridade atual.

---

## 11. Padrão global de acesso

Como padrão conceitual:

### `platform_owner`

É o dono da plataforma.

Possui acesso global aos tenants e pode realizar suporte e alterações administrativas.

Ações críticas devem gerar audit logs.

### `tenant_owner`

É o dono do negócio.

Administra somente o próprio tenant.

### Papéis específicos

Cada SaaS define seus próprios papéis adicionais.

Exemplos:

- `professional`;
- `dentist`;
- `receptionist`;
- `driver`;
- `staff`;
- `customer`;
- `patient`.

Não criar papéis irrelevantes apenas para padronizar nomes.

---

## 12. Padrões globais recomendados

Sempre considerar, quando aplicável:

- Multi-Tenant;
- White-Label;
- `tenantId`;
- memberships;
- RBAC;
- Platform Owner;
- tenant resolver;
- isolamento de dados;
- Firestore Security Rules;
- Storage Rules;
- audit logs;
- feature flags;
- limites configuráveis;
- tenant desativado sem exclusão automática;
- documentação versionada;
- `docs/CURRENT.md`;
- diagramas atualizados;
- screenshots reais;
- testes Tenant A × Tenant B;
- migração segura do cliente original;
- segundo tenant de teste;
- onboarding sem alteração de código;
- deploy compartilhado dentro da vertical quando tecnicamente adequado.

---

## 13. Padrão de documentação dos repositórios

Quando possível, cada produto deve seguir:

```text
docs/
├── README.md
├── CURRENT.md
└── versions/
    └── vXX-<nome-da-versao>/
        ├── README.md
        ├── STATUS.md
        ├── ARCHITECTURE.md
        ├── SECURITY.md
        ├── DATA_MODEL.md
        ├── DEPLOYMENT.md
        ├── MIGRATION.md
        ├── SCREENS.md
        ├── ROADMAP.md
        ├── diagrams/
        └── screenshots/
```

`docs/CURRENT.md` deve apontar para a documentação vigente.

Documentação antiga pode permanecer como histórico, mas não é fonte da verdade.

---

## 14. Padrão para novidades que surgem durante trabalhos grandes

Se o Codex já estiver executando um goal importante e surgir uma nova ideia:

### NÃO fazer automaticamente

- aumentar o goal atual;
- interromper migração;
- adicionar dezenas de telas;
- misturar feature nova com refatoração estrutural;
- transformar todo novo insight em requisito de aceite atual.

### Fazer

1. registrar no Core;
2. registrar no roadmap do produto;
3. indicar dependências;
4. marcar como `DEFERRED` ou `NEXT`;
5. concluir primeiro o trabalho atual;
6. depois gerar um goal específico para a feature.

---

## 15. Formato para registrar uma nova decisão

Use este template:

```md
# CHANGE — <nome>

Data:
Versão:
Status: PLANNED / ACTIVE / DEFERRED / DEPRECATED

## Escopo
GLOBAL / VERTICAL / LOCAL

## Tipo
Arquitetura / Backend / Banco / Auth / Segurança / UX/UI / Landing / Comercial / Feature / Docs

## Origem
De onde surgiu a ideia ou referência.

## Problema
O que estamos tentando melhorar.

## Decisão
O que foi decidido.

## Afeta
- produto A
- produto B

## Não afeta
- produto X

## Dependências
O que precisa existir antes.

## Prioridade
NOW / NEXT / DEFERRED

## Implementação
O que deve mudar quando chegar a hora.

## Não implementar agora
O que está explicitamente fora do escopo atual.

## Critérios de aceite
Como saber que a mudança foi aplicada corretamente.
```

---

## 16. Responsabilidade do chat central

O chat central do Project funciona como:

# SAAS CORE / ARQUITETO DO ECOSSISTEMA

Quando uma nova ideia for apresentada, ele deve responder:

- isso é GLOBAL, VERTICAL ou LOCAL?
- quais SaaS são afetados?
- quais não são?
- é obrigatório ou opcional?
- muda arquitetura ou apenas experiência?
- deve ser implementado agora ou entrar no roadmap?
- quais repos estão desatualizados?
- é necessário gerar novos goals?

Ele deve evitar que o usuário precise repetir manualmente a mesma decisão em todos os chats.

---

## 17. Responsabilidade dos chats especialistas

Cada chat especialista deve cuidar profundamente do seu domínio e manter:

- estado atual;
- decisões;
- implementação;
- pendências;
- bugs;
- roadmap;
- documentação;
- diagramas;
- goals;
- versões.

Quando um especialista descobrir algo com potencial global ou transversal, deve recomendar que a decisão seja promovida para este Core.

---

## 18. Estado inicial dos produtos

Produtos conhecidos atualmente dentro do ecossistema incluem, entre outros:

- SaaS Açaí;
- SaaS Sorveteria;
- SaaS Sushi;
- SaaS Food;
- SaaS Banca;
- SaaS Manicure;
- SaaS Dentista;
- SaaS Cosmaker;
- SaaS Caravana.

Essa lista pode crescer.

Não presumir que todos estão no mesmo estágio de implementação.

O estado real deve ser confirmado pelo chat/repositório específico.

---

## 19. Prioridade operacional

A prioridade é construir produtos utilizáveis e conquistar clientes reais.

Não criar abstrações apenas porque talvez sejam úteis um dia.

Ao mesmo tempo, evitar decisões que tornem integrações futuras desnecessariamente difíceis.

Regra:

> **Registrar conhecimento compartilhado agora, sem obrigar implementação prematura.**

---

## 20. Regra final

O objetivo deste arquivo é transformar vários SaaS independentes em um **ecossistema coordenado**, e não em um único software gigante.

Os produtos continuam especializados.

O conhecimento compartilhado fica centralizado.

Novas ideias são avaliadas uma vez.

Cada produto recebe somente o que realmente faz sentido para ele.

Este arquivo é a fonte central para decisões compartilhadas dentro do Project SaaS.
