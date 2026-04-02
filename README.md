# API Gestor (TypeScript)

API REST em Node.js + Express + SQLite com tipagem forte em TypeScript.

## Rodar localmente

```bash
cd gestor-api
pnpm install
pnpm dev
```

API: `http://localhost:3333/api`

## Build de produÃ§Ã£o

```bash
pnpm build
pnpm start
```

## Endpoints principais

- `GET /api/health`
- `GET /api/usuarios`
- `GET /api/projetos`
- `POST /api/projetos`
- `PUT /api/projetos/:id`
- `PATCH /api/projetos/:id/principal`
- `DELETE /api/projetos/:id`
- `GET /api/projetos/:projetoId/raias`
- `POST /api/projetos/:projetoId/raias`
- `PUT /api/raias/:id`
- `DELETE /api/raias/:id`
- `PUT /api/projetos/:projetoId/raias/reordenar`
- `GET /api/projetos/:projetoId/atividades`
- `POST /api/projetos/:projetoId/atividades`
- `GET /api/atividades/:id`
- `PUT /api/atividades/:id`
- `PATCH /api/atividades/:id/checklist`
- `POST /api/atividades/:id/comentarios`
- `DELETE /api/atividades/:id`
- `PUT /api/raias/:raiaId/atividades/reordenar`

## Banco

O arquivo SQLite Ã© criado automaticamente em:

- `gestor-api/dados.db`

TambÃ©m Ã© aplicado seed inicial com usuÃ¡rios, projetos, raias e atividades.


## Configuracao de e-mail (SMTP)

Para envio do codigo de segundo fator, configure no arquivo `.env`:

```bash
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_SEGURO=false
SMTP_USUARIO=usuario-smtp
SMTP_SENHA=senha-smtp
SMTP_REMETENTE=Gestor <no-reply@seu-dominio.com>
```
