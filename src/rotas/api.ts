import { randomUUID } from 'node:crypto';

import express, { NextFunction, Request, Response } from 'express';

import { executar, listar, obter, transacao } from '../banco/conexao';
import {
  AdicionarComentarioPayload,
  Atividade,
  AtualizarAtividadePayload,
  AtualizarChecklistPayload,
  AtualizarProjetoPayload,
  AtualizarRaiaPayload,
  Comentario,
  CriarAtividadePayload,
  CriarProjetoPayload,
  CriarRaiaPayload,
  Projeto,
  Raia,
  ReordenarAtividadesPayload,
  ReordenarRaiasPayload,
  Usuario,
} from '../tipos/dominio';
import { ApiErro } from '../tipos/erros';
import { agoraIso, jsonSeguroParse } from '../util/serializacao';

interface ProjetoBanco {
  id: string;
  nome: string;
  descricao: string;
  cor: string | null;
  principal: number;
  status: 'ATIVO' | 'INATIVO';
  criado_em: string;
  atualizado_em: string;
}

interface RaiaBanco {
  id: string;
  projeto_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface AtividadeBanco {
  id: string;
  projeto_id: string;
  raia_id: string;
  titulo: string;
  descricao: string;
  prioridade: Atividade['prioridade'];
  status: Atividade['status'];
  responsavel: string;
  prazo: string;
  etiquetas_json: string;
  checklist_json: string;
  comentarios_json: string;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

interface IdApenas {
  id: string;
}

interface ProximaOrdemLinha {
  proxima_ordem: number;
}

export const roteador = express.Router();

function mapearProjeto(linha: ProjetoBanco): Projeto {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    cor: linha.cor,
    principal: Boolean(linha.principal),
    status: linha.status,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function mapearRaia(linha: RaiaBanco): Raia {
  return {
    id: linha.id,
    projetoId: linha.projeto_id,
    nome: linha.nome,
    ordem: linha.ordem,
    cor: linha.cor,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function mapearAtividade(linha: AtividadeBanco): Atividade {
  return {
    id: linha.id,
    projetoId: linha.projeto_id,
    raiaId: linha.raia_id,
    titulo: linha.titulo,
    descricao: linha.descricao,
    prioridade: linha.prioridade,
    status: linha.status,
    responsavel: linha.responsavel,
    prazo: linha.prazo,
    etiquetas: jsonSeguroParse(linha.etiquetas_json, []),
    checklist: jsonSeguroParse(linha.checklist_json, []),
    comentarios: jsonSeguroParse(linha.comentarios_json, []),
    ordem: linha.ordem,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function validarObrigatorio(valor: unknown, campo: string): void {
  if (!valor || String(valor).trim() === '') {
    throw new ApiErro(`Campo obrigatório: ${campo}`);
  }
}

function tratarAssincrono(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

roteador.get(
  '/usuarios',
  tratarAssincrono(async (_req, res) => {
    const usuarios = await listar<Usuario>('SELECT id, nome, email, iniciais FROM usuarios ORDER BY nome');
    res.json(usuarios);
  }),
);

roteador.get(
  '/projetos',
  tratarAssincrono(async (_req, res) => {
    const projetos = await listar<ProjetoBanco>('SELECT * FROM projetos ORDER BY principal DESC, atualizado_em DESC');
    res.json(projetos.map(mapearProjeto));
  }),
);

roteador.get(
  '/projetos/:id',
  tratarAssincrono(async (req, res) => {
    const projeto = await obter<ProjetoBanco>('SELECT * FROM projetos WHERE id = ?', [req.params.id]);
    if (!projeto) {
      throw new ApiErro('Projeto nao encontrado.', 404);
    }
    res.json(mapearProjeto(projeto));
  }),
);

roteador.post(
  '/projetos',
  tratarAssincrono(async (req, res) => {
    const dados = req.body as CriarProjetoPayload;
    validarObrigatorio(dados.nome, 'nome');
    validarObrigatorio(dados.descricao, 'descricao');

    const agora = agoraIso();
    const id = randomUUID();

    await executar(
      `INSERT INTO projetos (id, nome, descricao, cor, principal, status, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, 0, 'ATIVO', ?, ?)`,
      [id, String(dados.nome).trim(), String(dados.descricao).trim(), dados.cor ?? null, agora, agora],
    );

    const projeto = await obter<ProjetoBanco>('SELECT * FROM projetos WHERE id = ?', [id]);
    res.status(201).json(mapearProjeto(projeto as ProjetoBanco));
  }),
);

roteador.put(
  '/projetos/:id',
  tratarAssincrono(async (req, res) => {
    const projetoExistente = await obter<ProjetoBanco>('SELECT * FROM projetos WHERE id = ?', [req.params.id]);
    if (!projetoExistente) {
      throw new ApiErro('Projeto nao encontrado.', 404);
    }

    const dados = req.body as AtualizarProjetoPayload;
    const nome = String(dados.nome ?? projetoExistente.nome).trim();
    const descricao = String(dados.descricao ?? projetoExistente.descricao).trim();
    const cor = dados.cor ?? projetoExistente.cor;

    await executar('UPDATE projetos SET nome = ?, descricao = ?, cor = ?, atualizado_em = ? WHERE id = ?', [
      nome,
      descricao,
      cor,
      agoraIso(),
      req.params.id,
    ]);

    const atualizado = await obter<ProjetoBanco>('SELECT * FROM projetos WHERE id = ?', [req.params.id]);
    res.json(mapearProjeto(atualizado as ProjetoBanco));
  }),
);

roteador.patch(
  '/projetos/:id/principal',
  tratarAssincrono(async (req, res) => {
    const projetoExistente = await obter<ProjetoBanco>('SELECT * FROM projetos WHERE id = ?', [req.params.id]);
    if (!projetoExistente) {
      throw new ApiErro('Projeto nao encontrado.', 404);
    }

    await transacao(async () => {
      await executar('UPDATE projetos SET principal = 0');
      await executar('UPDATE projetos SET principal = 1, atualizado_em = ? WHERE id = ?', [agoraIso(), req.params.id]);
    });

    const projeto = await obter<ProjetoBanco>('SELECT * FROM projetos WHERE id = ?', [req.params.id]);
    res.json(mapearProjeto(projeto as ProjetoBanco));
  }),
);

roteador.delete(
  '/projetos/:id',
  tratarAssincrono(async (req, res) => {
    const projeto = await obter<ProjetoBanco>('SELECT * FROM projetos WHERE id = ?', [req.params.id]);
    if (!projeto) {
      throw new ApiErro('Projeto nao encontrado.', 404);
    }

    await executar('DELETE FROM projetos WHERE id = ?', [req.params.id]);

    const principalAtual = await obter<IdApenas>('SELECT id FROM projetos WHERE principal = 1 LIMIT 1');
    if (!principalAtual) {
      const primeiroProjeto = await obter<IdApenas>('SELECT id FROM projetos ORDER BY atualizado_em DESC LIMIT 1');
      if (primeiroProjeto) {
        await executar('UPDATE projetos SET principal = 1 WHERE id = ?', [primeiroProjeto.id]);
      }
    }

    res.status(204).send();
  }),
);

roteador.get(
  '/raias',
  tratarAssincrono(async (_req, res) => {
    const raias = await listar<RaiaBanco>('SELECT * FROM raias ORDER BY projeto_id, ordem');
    res.json(raias.map(mapearRaia));
  }),
);

roteador.get(
  '/projetos/:projetoId/raias',
  tratarAssincrono(async (req, res) => {
    const raias = await listar<RaiaBanco>('SELECT * FROM raias WHERE projeto_id = ? ORDER BY ordem', [req.params.projetoId]);
    res.json(raias.map(mapearRaia));
  }),
);

roteador.post(
  '/projetos/:projetoId/raias',
  tratarAssincrono(async (req, res) => {
    const dados = req.body as CriarRaiaPayload;
    validarObrigatorio(dados.nome, 'nome');

    const linhaOrdem = await obter<ProximaOrdemLinha>(
      'SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem FROM raias WHERE projeto_id = ?',
      [req.params.projetoId],
    );

    const id = randomUUID();
    await executar(
      `INSERT INTO raias (id, projeto_id, nome, ordem, cor, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.projetoId, String(dados.nome).trim(), linhaOrdem?.proxima_ordem ?? 1, dados.cor ?? null, agoraIso(), agoraIso()],
    );

    const raia = await obter<RaiaBanco>('SELECT * FROM raias WHERE id = ?', [id]);
    res.status(201).json(mapearRaia(raia as RaiaBanco));
  }),
);

roteador.put(
  '/raias/:id',
  tratarAssincrono(async (req, res) => {
    const raia = await obter<RaiaBanco>('SELECT * FROM raias WHERE id = ?', [req.params.id]);
    if (!raia) {
      throw new ApiErro('Raia nao encontrada.', 404);
    }

    const dados = req.body as AtualizarRaiaPayload;
    await executar('UPDATE raias SET nome = ?, cor = ?, atualizado_em = ? WHERE id = ?', [
      String(dados.nome ?? raia.nome).trim(),
      dados.cor ?? raia.cor,
      agoraIso(),
      req.params.id,
    ]);

    const atualizada = await obter<RaiaBanco>('SELECT * FROM raias WHERE id = ?', [req.params.id]);
    res.json(mapearRaia(atualizada as RaiaBanco));
  }),
);

roteador.put(
  '/projetos/:projetoId/raias/reordenar',
  tratarAssincrono(async (req, res) => {
    const dados = req.body as ReordenarRaiasPayload;
    const raias = Array.isArray(dados.raias) ? dados.raias : [];

    await transacao(async () => {
      for (let indice = 0; indice < raias.length; indice += 1) {
        await executar('UPDATE raias SET ordem = ?, atualizado_em = ? WHERE id = ? AND projeto_id = ?', [
          indice + 1,
          agoraIso(),
          raias[indice].id,
          req.params.projetoId,
        ]);
      }
    });

    const resultado = await listar<RaiaBanco>('SELECT * FROM raias WHERE projeto_id = ? ORDER BY ordem', [req.params.projetoId]);
    res.json(resultado.map(mapearRaia));
  }),
);

roteador.delete(
  '/raias/:id',
  tratarAssincrono(async (req, res) => {
    const raia = await obter<RaiaBanco>('SELECT * FROM raias WHERE id = ?', [req.params.id]);
    if (!raia) {
      throw new ApiErro('Raia nao encontrada.', 404);
    }

    await executar('DELETE FROM raias WHERE id = ?', [req.params.id]);

    const raiasProjeto = await listar<IdApenas>('SELECT id FROM raias WHERE projeto_id = ? ORDER BY ordem', [raia.projeto_id]);
    for (let indice = 0; indice < raiasProjeto.length; indice += 1) {
      await executar('UPDATE raias SET ordem = ?, atualizado_em = ? WHERE id = ?', [indice + 1, agoraIso(), raiasProjeto[indice].id]);
    }

    res.status(204).send();
  }),
);

roteador.get(
  '/atividades',
  tratarAssincrono(async (_req, res) => {
    const atividades = await listar<AtividadeBanco>('SELECT * FROM atividades ORDER BY projeto_id, raia_id, ordem');
    res.json(atividades.map(mapearAtividade));
  }),
);

roteador.get(
  '/projetos/:projetoId/atividades',
  tratarAssincrono(async (req, res) => {
    const atividades = await listar<AtividadeBanco>('SELECT * FROM atividades WHERE projeto_id = ? ORDER BY ordem', [req.params.projetoId]);
    res.json(atividades.map(mapearAtividade));
  }),
);

roteador.get(
  '/atividades/:id',
  tratarAssincrono(async (req, res) => {
    const atividade = await obter<AtividadeBanco>('SELECT * FROM atividades WHERE id = ?', [req.params.id]);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }
    res.json(mapearAtividade(atividade));
  }),
);

roteador.post(
  '/projetos/:projetoId/atividades',
  tratarAssincrono(async (req, res) => {
    const dados = req.body as CriarAtividadePayload;
    validarObrigatorio(dados.raiaId, 'raiaId');
    validarObrigatorio(dados.titulo, 'titulo');
    validarObrigatorio(dados.descricao, 'descricao');
    validarObrigatorio(dados.prioridade, 'prioridade');
    validarObrigatorio(dados.status, 'status');
    validarObrigatorio(dados.responsavel, 'responsavel');
    validarObrigatorio(dados.prazo, 'prazo');

    const linhaOrdem = await obter<ProximaOrdemLinha>('SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem FROM atividades WHERE raia_id = ?', [
      dados.raiaId,
    ]);

    const id = randomUUID();
    await executar(
      `INSERT INTO atividades (
        id, projeto_id, raia_id, titulo, descricao, prioridade, status,
        responsavel, prazo, etiquetas_json, checklist_json, comentarios_json,
        ordem, criado_em, atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.params.projetoId,
        dados.raiaId,
        String(dados.titulo).trim(),
        String(dados.descricao).trim(),
        dados.prioridade,
        dados.status,
        dados.responsavel,
        dados.prazo,
        JSON.stringify(dados.etiquetas ?? []),
        JSON.stringify(dados.checklist ?? []),
        JSON.stringify(dados.comentarios ?? []),
        linhaOrdem?.proxima_ordem ?? 1,
        agoraIso(),
        agoraIso(),
      ],
    );

    const atividade = await obter<AtividadeBanco>('SELECT * FROM atividades WHERE id = ?', [id]);
    res.status(201).json(mapearAtividade(atividade as AtividadeBanco));
  }),
);

roteador.put(
  '/atividades/:id',
  tratarAssincrono(async (req, res) => {
    const atividade = await obter<AtividadeBanco>('SELECT * FROM atividades WHERE id = ?', [req.params.id]);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }

    const dados = req.body as AtualizarAtividadePayload;

    await executar(
      `UPDATE atividades SET
        raia_id = ?,
        titulo = ?,
        descricao = ?,
        prioridade = ?,
        status = ?,
        responsavel = ?,
        prazo = ?,
        etiquetas_json = ?,
        checklist_json = ?,
        comentarios_json = ?,
        atualizado_em = ?
      WHERE id = ?`,
      [
        dados.raiaId ?? atividade.raia_id,
        String(dados.titulo ?? atividade.titulo).trim(),
        String(dados.descricao ?? atividade.descricao).trim(),
        dados.prioridade ?? atividade.prioridade,
        dados.status ?? atividade.status,
        dados.responsavel ?? atividade.responsavel,
        dados.prazo ?? atividade.prazo,
        JSON.stringify(dados.etiquetas ?? jsonSeguroParse(atividade.etiquetas_json, [])),
        JSON.stringify(dados.checklist ?? jsonSeguroParse(atividade.checklist_json, [])),
        JSON.stringify(dados.comentarios ?? jsonSeguroParse(atividade.comentarios_json, [])),
        agoraIso(),
        req.params.id,
      ],
    );

    const atualizada = await obter<AtividadeBanco>('SELECT * FROM atividades WHERE id = ?', [req.params.id]);
    res.json(mapearAtividade(atualizada as AtividadeBanco));
  }),
);

roteador.patch(
  '/atividades/:id/checklist',
  tratarAssincrono(async (req, res) => {
    const dados = req.body as AtualizarChecklistPayload;

    await executar('UPDATE atividades SET checklist_json = ?, atualizado_em = ? WHERE id = ?', [
      JSON.stringify(Array.isArray(dados.checklist) ? dados.checklist : []),
      agoraIso(),
      req.params.id,
    ]);

    const atividade = await obter<AtividadeBanco>('SELECT * FROM atividades WHERE id = ?', [req.params.id]);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }

    res.json(mapearAtividade(atividade));
  }),
);

roteador.post(
  '/atividades/:id/comentarios',
  tratarAssincrono(async (req, res) => {
    const dados = req.body as AdicionarComentarioPayload;
    validarObrigatorio(dados.texto, 'texto');

    const atividade = await obter<AtividadeBanco>('SELECT * FROM atividades WHERE id = ?', [req.params.id]);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }

    const comentarios = jsonSeguroParse<Comentario[]>(atividade.comentarios_json, []);
    comentarios.push({
      id: randomUUID(),
      atividadeId: String(req.params.id),
      usuarioId: dados.usuarioId ?? 'Usuario atual',
      texto: String(dados.texto).trim(),
      criadoEm: agoraIso(),
    });

    await executar('UPDATE atividades SET comentarios_json = ?, atualizado_em = ? WHERE id = ?', [
      JSON.stringify(comentarios),
      agoraIso(),
      req.params.id,
    ]);

    const atualizada = await obter<AtividadeBanco>('SELECT * FROM atividades WHERE id = ?', [req.params.id]);
    res.json(mapearAtividade(atualizada as AtividadeBanco));
  }),
);

roteador.delete(
  '/atividades/:id',
  tratarAssincrono(async (req, res) => {
    const atividade = await obter<AtividadeBanco>('SELECT * FROM atividades WHERE id = ?', [req.params.id]);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }

    await executar('DELETE FROM atividades WHERE id = ?', [req.params.id]);

    const atividadesRaia = await listar<IdApenas>('SELECT id FROM atividades WHERE raia_id = ? ORDER BY ordem', [atividade.raia_id]);
    for (let indice = 0; indice < atividadesRaia.length; indice += 1) {
      await executar('UPDATE atividades SET ordem = ?, atualizado_em = ? WHERE id = ?', [
        indice + 1,
        agoraIso(),
        atividadesRaia[indice].id,
      ]);
    }

    res.status(204).send();
  }),
);

roteador.put(
  '/raias/:raiaId/atividades/reordenar',
  tratarAssincrono(async (req, res) => {
    const dados = req.body as ReordenarAtividadesPayload;
    const atividades = Array.isArray(dados.atividades) ? dados.atividades : [];

    await transacao(async () => {
      for (let indice = 0; indice < atividades.length; indice += 1) {
        await executar('UPDATE atividades SET ordem = ?, atualizado_em = ? WHERE id = ? AND raia_id = ?', [
          indice + 1,
          agoraIso(),
          atividades[indice].id,
          req.params.raiaId,
        ]);
      }
    });

    const resultado = await listar<AtividadeBanco>('SELECT * FROM atividades WHERE raia_id = ? ORDER BY ordem', [req.params.raiaId]);
    res.json(resultado.map(mapearAtividade));
  }),
);
