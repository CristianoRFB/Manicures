# PRE_PC_COMPLETENESS — Manicure

## Métrica de continuidade
Baseline aprovado do último turno: **22/42 entregas de engenharia CODE_COMPLETE (52,4%)**.
Após os commits subsequentes: **24/42 (57,1%)**, contabilizando somente dois módulos que passaram de incompletos a comprovados por código + CI:
- **09** `tenant_admins` — endpoint confiável, contador com CAS, auditoria, UI Platform Owner, testes Essencial/Pro, downgrade, desativação e Tenant A × B
- **11** override gerenciável — formulário Platform Owner + Worker com persistência, audit log e teste do bloqueio real de booking

Não foram convertidos em DONE os seguintes itens ainda parciais: downgrade UX excedentes (13), edição de profissionais (17: apenas ativação/desativação está operacional), horários configuráveis (18–20), painel Owner completo (32), UX cross-device (34), gestão ampla de memberships (36), auditoria de todas as operações (37), exportação/artefatos (39).

**Marcadores que melhoraram sem alterar o numerador**:
- Corrigida indisponibilidade que cruzava a pausa de almoço e adicionado teste.
- Profissional pode ser desativada/reativada pelo Worker com CAS e bloqueio de reservas futuras; teste A×B e downgrade.
- Valor BRL parseado em centavos exatos com testes.
- Botões reais de status do atendimento conectados ao Worker; corrigida renderização de coluna de ações.
- Troca rápida de tenant limpa estado e ignora respostas assíncronas anteriores.
- `npm run test:pre-pc` agrega as validações executáveis em CI/PC.

## Contratos de engenharia ainda abertos

| Grupo | Parcial ou faltante | Prova exigida |
|---|---|---|
| M1 | Downgrade com UX de excedente e cobertura de billing manual | Testes sem perda de dados/histórico |
| M2 | Editar serviços/profissionais, horários por profissional e exceções, remarcação | Worker + Rules + Emulator + UI |
| M3 | Histórico/autoatendimento do cliente, dashboard profissional, editor white-label, UX em quatro viewports | Auth/RBAC por tenant, testes e screenshots reais |
| M4 | Gestão de outros papéis com convites, exportação autorizada, logs completos e mídia persistente | Backend e Rules |
| M5 | Browser real desktop/mobile e ensaio hospedado | EXTERNAL_GATE; não conta como CODE_COMPLETE |

## Não mover para NOW sem decisão aprovada
Gateway, checkout, billing automático, dunning, WhatsApp pago, integração paga, domínio custom automático, múltiplas unidades, módulos Premium futuros DEFERRED.

## Evidência
- Repo: `CristianoRFB/Manicures`
- Branch: `feat/core-multitenant-firebase`
- PR: https://github.com/CristianoRFB/Manicures/pull/1
- Os resultados do CI do SHA final devem ser consultados no Actions; nunca inferir PASS do arquivo Markdown.
- A execução em produção e o merge da PR são decisões separadas e não foram autorizados.
