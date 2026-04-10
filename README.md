# API Gestor

API REST em Node.js, Express e SQLite com TypeScript.

## Scripts

```bash
pnpm install
pnpm dev
pnpm build
pnpm start
pnpm test
```

API base: `http://localhost:3333/api`

## Endpoints principais

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/2fa/validar`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/usuarios`
- `GET /api/projetos`
- `GET /api/projetos/:id`
- `GET /api/projetos/:id/historico`
- `POST /api/projetos`
- `PUT /api/projetos/:id`
- `PATCH /api/projetos/:id/principal`
- `PATCH /api/projetos/:id/status`
- `GET /api/raias`
- `GET /api/projetos/:projetoId/raias`
- `PUT /api/projetos/:projetoId/raias/reordenar`
- `GET /api/atividades`
- `GET /api/projetos/:projetoId/atividades`
- `GET /api/atividades/:id`
- `GET /api/atividades/:id/historico`
- `POST /api/projetos/:projetoId/atividades`
- `PUT /api/atividades/:id`
- `PATCH /api/atividades/:id/checklist`
- `POST /api/atividades/:id/comentarios`
- `DELETE /api/atividades/:id`
- `PUT /api/raias/:raiaId/atividades/reordenar`

## Arquitetura

Estrutura atual:

```text
src/
  app.ts
  servidor.ts
  container.ts
  config/
  middleware/
  modules/
    auth/
    projetos/
    raias/
    atividades/
  rotas/
  infra/
  banco/
  tipos/
  utils/
  test/
```

Cada modulo segue o padrao:

- `controller`: traduz HTTP para caso de uso
- `service`: concentra regra de negocio
- `repository`: concentra acesso a dados
- `schemas`: validacao de entrada com Zod
- `types`: contratos internos do modulo

O composition root fica em `src/container.ts`.

## Health Check

`GET /api/health` verifica:

- status geral da API
- disponibilidade basica do SQLite

Retorna `200` quando o banco responde e `503` quando a API esta degradada.

## Banco

O arquivo SQLite e criado automaticamente em:

- `gestor-api/dados.db`

O bootstrap tambem aplica criacao de tabelas e seed inicial.

## SMTP

Para envio do codigo de segundo fator:

```bash
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_SEGURO=false
SMTP_USUARIO=usuario-smtp
SMTP_SENHA=senha-smtp
SMTP_REMETENTE=Gestor <no-reply@seu-dominio.com>
```

## Variaveis principais

```bash
PORTA_API=3333
ORIGEM_FRONTEND=http://localhost:4200
JWT_SEGREDO_ACESSO=...
JWT_SEGREDO_REFRESH=...
JWT_SEGREDO_DESAFIO=...
JWT_DURACAO_ACESSO=15m
JWT_DURACAO_REFRESH=7d
JWT_DURACAO_DESAFIO=10m
AUTH_2FA_ENABLED=false
LOG_NIVEL=debug
```

## Testes

`pnpm test` compila o projeto e executa o harness em `src/test/run.ts`.

Hoje a suite cobre regras criticas de:

- autenticacao
- projetos
- atividades

