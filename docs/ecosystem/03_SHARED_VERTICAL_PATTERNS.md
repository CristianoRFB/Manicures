# Padrões Compartilhados entre Verticais

Este arquivo registra reutilização conceitual entre grupos sem promover tudo a GLOBAL.

# 1. VERTICAL — Alimentação

Afeta:

- Açaí
- Sorveteria
- Sushi
- Food

## Padrões confirmados como compartilháveis

### Cardápio online
Mesmo conceito geral, regras de produto continuam locais.

### QR
Pode assumir:
- QR geral;
- QR de cardápio;
- QR por mesa/local quando houver salão.

Não obrigar mesa em tenant que não usa atendimento presencial.

### Pickup / retirada
Contrato conceitual compartilhável.

### Delivery
Compartilhável como capacidade.

Não mover toda a lógica de pedido para um serviço de logística.

### SharedDeliveryContract
O serviço futuro de logística deve receber somente dados necessários à entrega, por adaptador.

Não precisa conhecer composição interna de:
- açaí;
- sushi;
- pizza;
- sorvete.

### Driver / motoboy
Somente quando a vertical/tenant realmente usa entrega própria.

### Caixa / financeiro operacional
Conceitos compartilháveis, regras contábeis e domínio continuam locais.

### KDS
Compartilhável apenas entre operações com produção/cozinha.

### TableOrdering
Food/Sushi e outras operações com salão podem compartilhar o conceito.

Não promover automaticamente para Açaí/Sorveteria sem necessidade real.

## Não fazer

- fundir Açaí + Sorveteria + Sushi + Food;
- criar um banco único entre verticais;
- usar marketplace como justificativa de unificação.

# 2. VERTICAL — Agendamento

Afeta:

- Dentista
- Manicure

## Padrões compartilháveis

- Agenda por profissional
- Disponibilidade
- Bloqueios
- Pausas/folgas
- Agendamento público
- Cancelamento/remarcação
- Anti-double-booking
- Lembretes
- Histórico de atendimentos
- No-show quando fizer sentido

## Local Dentista

Continuam locais:
- prontuário clínico;
- odontograma;
- plano de tratamento;
- fotos clínicas;
- documentos clínicos;
- retenção/integridade clínica.

## Local Manicure

Continuam locais:
- taxonomia de manicure/pedicure;
- alongamento;
- manutenção;
- nail art;
- duração/preço dos procedimentos.

# 3. Compartilhamento parcial — Reservas / Eventos / Varejo

Há conceitos semelhantes em:

- Banca
- Caravana
- algumas verticais de alimentação

Mas ainda NÃO existe evidência suficiente para criar um padrão vertical único.

Possíveis componentes reutilizáveis:
- reserva;
- lembretes;
- expiração;
- retirada/check-in;
- notificações.

As regras de domínio continuam diferentes.

# 4. Compartilhamento parcial — Workflow / Aprovação

Cosmaker traz:
- orçamento;
- proposta;
- Kanban;
- uploads;
- aprovação de cliente;
- change requests.

Esses conceitos podem reaparecer em outros produtos, mas hoje não há segunda vertical consolidada suficiente para criar padrão oficial.

# 5. Regra

Promover de LOCAL → VERTICAL somente quando:
- pelo menos duas verticais realmente compartilham o mesmo problema;
- o contrato comum reduz duplicação real;
- não força abstração artificial.
