# API Gestor (TypeScript)

API REST em Node.js + Express + SQLite com tipagem forte em TypeScript.

## Rodar localmente

```bash
cd gestor-api
npm install
npm run dev
```

API: `http://localhost:3333/api`

## Build de produção

```bash
npm run build
npm run start
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

O arquivo SQLite é criado automaticamente em:

- `gestor-api/dados.db`

Também é aplicado seed inicial com usuários, projetos, raias e atividades.
