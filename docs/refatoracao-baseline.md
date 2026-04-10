# Baseline de refatoracao

Estado observado antes da refatoracao em camadas:

- Stack atual: Express 5, TypeScript, SQLite, JWT, Pino, Nodemailer.
- Entradas principais: `/api/auth`, `/api/projetos`, `/api/raias`, `/api/atividades`.
- Arquivos mais acoplados:
  - `src/rotas/api.ts`
  - `src/rotas/autenticacao.ts`
  - `src/servidor.ts`
- Riscos identificados antes da extracao por camadas:
  - validacao manual espalhada nas rotas
  - regras de negocio e SQL no mesmo modulo HTTP
  - segredos JWT definidos com fallback no codigo
  - ausencia de graceful shutdown do servidor HTTP e SQLite

Objetivo desta etapa:

- centralizar configuracao
- separar composicao do app do bootstrap
- preparar a aplicacao para extrair controllers, services e repositories sem mudar regra de negocio

