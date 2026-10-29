# NEXT CODEX STEP / CONTINUIDADE VIA CHAT

Última etapa: implementação direta na branch segura com CI, sem enviar ao Codex e sem deploy.
Os dez módulos concluídos desde 24/42 estão detalhados em `docs/PRE_PC_COMPLETENESS.md`.
É proibido repetir CORE_FIRST e migrar para outra stack.

Foco do código faltante:
1. Convites de equipe com expiração, verificação de e-mail e vínculo confiável ao tenant. Recuperação Firebase Auth já funciona.
2. Governança de mídia: EXIF, remoção LGPD, capacidade/egress e upload condicionado à disponibilidade. Galeria persistente + Storage Rules A×B já existem.
3. Melhorar reconciliação de contadores legacy, trial/suspensões e testes adicionais de concorrência.
4. QA real de browser mobile/desktop, screenshots autênticas e staging. Não simular screenshots.

Para verificar no PC: `npm run test:pre-pc`, `docs/PC_FINAL_TEST_SESSION.md`.
Não implementar billing, gateway ou marketplace prematuramente.
