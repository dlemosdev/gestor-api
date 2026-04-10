import express from 'express';

import { listar } from '../banco/conexao';
import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validation';
import { AtividadeController } from '../modules/atividades/atividade.controller';
import {
  adicionarComentarioSchema,
  atividadeIdParamsSchema,
  atualizarAtividadeSchema,
  atualizarChecklistSchema,
  criarAtividadeSchema,
  projetoAtividadesParamsSchema,
  raiaAtividadesParamsSchema,
  reordenarAtividadesSchema,
} from '../modules/atividades/atividade.schemas';
import { AtividadeRepository } from '../modules/atividades/atividade.repository';
import { AtividadeService } from '../modules/atividades/atividade.service';
import { ProjetoController } from '../modules/projetos/projeto.controller';
import { ProjetoRepository } from '../modules/projetos/projeto.repository';
import {
  atualizarProjetoSchema,
  atualizarStatusProjetoSchema,
  criarProjetoSchema,
  projetoIdParamsSchema,
} from '../modules/projetos/projeto.schemas';
import { ProjetoService } from '../modules/projetos/projeto.service';
import { RaiaController } from '../modules/raias/raia.controller';
import { RaiaRepository } from '../modules/raias/raia.repository';
import {
  projetoIdParamsSchema as projetoIdRaiasParamsSchema,
  reordenarRaiasSchema,
} from '../modules/raias/raia.schemas';
import { Usuario } from '../tipos/dominio';

export function criarRoteadorApi(deps: {
  projetoController: ProjetoController;
  raiaController: RaiaController;
  atividadeController: AtividadeController;
}) {
  const roteador = express.Router();
  const { projetoController, raiaController, atividadeController } = deps;

  roteador.get(
    '/usuarios',
    asyncHandler(async (_req, res) => {
      const usuarios = await listar<Usuario>('SELECT id, nome, email, iniciais FROM TB_Usuarios ORDER BY nome');
      res.json(usuarios);
    }),
  );

  roteador.get('/projetos', asyncHandler((req, res) => projetoController.listarProjetos(req, res)));

  roteador.get(
    '/projetos/:id',
    validate({ params: projetoIdParamsSchema }),
    asyncHandler((req, res) => projetoController.obterProjeto(req, res)),
  );

  roteador.get(
    '/projetos/:id/historico',
    validate({ params: projetoIdParamsSchema }),
    asyncHandler((req, res) => projetoController.listarHistorico(req, res)),
  );

  roteador.post(
    '/projetos',
    validate({ body: criarProjetoSchema }),
    asyncHandler((req, res) => projetoController.criarProjeto(req, res)),
  );

  roteador.put(
    '/projetos/:id',
    validate({ params: projetoIdParamsSchema, body: atualizarProjetoSchema }),
    asyncHandler((req, res) => projetoController.atualizarProjeto(req, res)),
  );

  roteador.patch(
    '/projetos/:id/principal',
    validate({ params: projetoIdParamsSchema }),
    asyncHandler((req, res) => projetoController.definirPrincipal(req, res)),
  );

  roteador.patch(
    '/projetos/:id/status',
    validate({ params: projetoIdParamsSchema, body: atualizarStatusProjetoSchema }),
    asyncHandler((req, res) => projetoController.atualizarStatus(req, res)),
  );

  roteador.get('/raias', asyncHandler((req, res) => raiaController.listarTodas(req, res)));

  roteador.get(
    '/projetos/:projetoId/raias',
    validate({ params: projetoIdRaiasParamsSchema }),
    asyncHandler((req, res) => raiaController.listarPorProjeto(req, res)),
  );

  roteador.put(
    '/projetos/:projetoId/raias/reordenar',
    validate({ params: projetoIdRaiasParamsSchema, body: reordenarRaiasSchema }),
    asyncHandler((req, res) => raiaController.reordenar(req, res)),
  );

  roteador.get('/atividades', asyncHandler((req, res) => atividadeController.listarTodas(req, res)));

  roteador.get(
    '/projetos/:projetoId/atividades',
    validate({ params: projetoAtividadesParamsSchema }),
    asyncHandler((req, res) => atividadeController.listarPorProjeto(req, res)),
  );

  roteador.get(
    '/atividades/:id',
    validate({ params: atividadeIdParamsSchema }),
    asyncHandler((req, res) => atividadeController.obterPorId(req, res)),
  );

  roteador.get(
    '/atividades/:id/historico',
    validate({ params: atividadeIdParamsSchema }),
    asyncHandler((req, res) => atividadeController.listarHistorico(req, res)),
  );

  roteador.post(
    '/projetos/:projetoId/atividades',
    validate({ params: projetoAtividadesParamsSchema, body: criarAtividadeSchema }),
    asyncHandler((req, res) => atividadeController.criar(req, res)),
  );

  roteador.put(
    '/atividades/:id',
    validate({ params: atividadeIdParamsSchema, body: atualizarAtividadeSchema }),
    asyncHandler((req, res) => atividadeController.atualizar(req, res)),
  );

  roteador.patch(
    '/atividades/:id/checklist',
    validate({ params: atividadeIdParamsSchema, body: atualizarChecklistSchema }),
    asyncHandler((req, res) => atividadeController.atualizarChecklist(req, res)),
  );

  roteador.post(
    '/atividades/:id/comentarios',
    validate({ params: atividadeIdParamsSchema, body: adicionarComentarioSchema }),
    asyncHandler((req, res) => atividadeController.adicionarComentario(req, res)),
  );

  roteador.delete(
    '/atividades/:id',
    validate({ params: atividadeIdParamsSchema }),
    asyncHandler((req, res) => atividadeController.excluir(req, res)),
  );

  roteador.put(
    '/raias/:raiaId/atividades/reordenar',
    validate({ params: raiaAtividadesParamsSchema, body: reordenarAtividadesSchema }),
    asyncHandler((req, res) => atividadeController.reordenarPorRaia(req, res)),
  );

  return roteador;
}
