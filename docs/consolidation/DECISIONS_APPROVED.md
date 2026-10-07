# DECISÕES APROVADAS — SaaS Manicure

Todas as decisões abaixo foram explicitamente aprovadas pelo usuário em 06/10/2026.

## Preços

- Essencial: **R$ 49,90/mês**
- Pro: **R$ 79,90/mês**
- Premium: **R$ 119,90/mês**

## Anual

- Essencial: **R$ 499/ano**
- Pro: **R$ 799/ano**
- Premium: **R$ 1.199/ano**

Estratégia aprovada: aproximadamente dois meses de desconto sobre 12 mensalidades.

## Trial

- **14 dias**
- **sem cartão** na fase inicial.

## Implantação / onboarding

- self-service: **R$ 0**
- onboarding assistido opcional: **R$ 149**

## Planos

Nomes aprovados:

- **Essencial**
- **Pro**
- **Premium**

Plano destacado/recomendado:

- **Pro**

## Público

### Essencial
Manicure autônoma.

### Pro
Pequeno studio / operação com equipe reduzida.

### Premium
Studio com equipe maior e futura necessidade de módulos avançados.

## Limites comerciais aprovados

### Profissionais ativos
- Essencial: **1**
- Pro: **3**
- Premium: **10**

### Tenant admins adicionais
- Essencial: **0**
- Pro: **2**
- Premium: **5**

### Sem limite comercial inicial
- clientes;
- serviços;
- agendamentos.

### Unidades
- **1 unidade por tenant** por enquanto.
- multi-unit permanece DEFERRED.

### Armazenamento
- sem limite comercial divulgado inicialmente.

### Automações
- sem quota numérica definida agora.

## Features por plano

### Essencial
Núcleo funcional completo:
- serviços;
- preço/duração;
- agenda;
- disponibilidade;
- pausas/folgas/bloqueios;
- agendamento;
- clientes;
- histórico;
- cancelamento/remarcação;
- no-show básico;
- página pública;
- link de agendamento;
- branding básico;
- WhatsApp manual.

### Pro
Tudo do Essencial, mais, quando implementado:
- múltiplas profissionais até 3;
- lembretes automáticos;
- lista de espera;
- relatórios básicos;
- fidelidade.

### Premium
Tudo do Pro, mais, quando implementado:
- até 10 profissionais;
- pacotes;
- comissões;
- financeiro;
- estoque;
- relatórios avançados;
- CRM avançado.

## Não diferenciar por plano

Devem existir independentemente do plano:
- isolamento entre tenants;
- segurança;
- autorização;
- integridade de dados;
- prevenção de double booking;
- snapshots de preço/duração;
- correções de bug;
- preservação de histórico no downgrade.

## Demo

Aprovado:
- `premium_demo`;
- simula Premium;
- libera somente features realmente implementadas;
- identificação explícita de “Ambiente de demonstração”;
- dados fictícios;
- sem cobrança real;
- sem automações externas reais sem ação explícita.

## Landing / pricing

Aprovado:
- destacar o plano **Pro**;
- tabela principal curta;
- comparar principalmente:
  - preço;
  - profissionais;
  - automações;
  - gestão/relatórios;
  - módulos avançados.

Não colocar como diferencial comercial:
- RBAC;
- Security Rules;
- tenant resolver;
- audit logs;
- subscription status;
- entitlement overrides;
- isolamento;
- double booking.

## Add-on de profissional extra

- NÃO vender agora.
- sugestão antiga de +R$15/mês permanece DEFERRED.

## Estado

Estas decisões passam de PROPOSTA/RECOMENDAÇÃO para **APROVADAS**.
