import { randomUUID } from 'node:crypto';

import express, { NextFunction, Request, Response } from 'express';

import { executar, listar, obter, transacao } from '../banco/conexao';
import {
  AdicionarComentarioPayload,
  Atividade,
  AtualizarAtividadePayload,
  AtualizarChecklistPayload,
  AtualizarProjetoPayload,
  Comentario,
  CriarAtividadePayload,
  CriarProjetoPayload,
  Projeto,
  Raia,
  RaiaPadraoProjeto,
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
  codigo_referencia: string;
  tipo: Atividade['tipo'];
  atividade_pai_id: string | null;
  titulo: string;
  descricao: string;
  prioridade: Atividade['prioridade'];
  status: Atividade['status'];
  responsavel: string;
  prazo: string;
  data_conclusao: string | null;
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

interface CodigoReferenciaBanco {
  codigo_referencia: string;
}

interface ProximaOrdemLinha {
  proxima_ordem: number;
}

const TABELAS = {
  usuarios: 'TB_Usuarios',
  projetos: 'TB_Projetos',
  raias: 'TB_Raias',
  atividades: 'TB_Atividades',
} as const;

const RAIAS_PADRAO_PROJETO: Record<RaiaPadraoProjeto, string> = {
  BACKLOG: 'Backlog',
  EM_ANDAMENTO: 'Em andamento',
  TESTE: 'Teste',
  AGUARDANDO_PUBLICACAO: 'Aguardando publicação',
  CONCLUIDAS: 'Concluídas',
};

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
    codigoReferencia: linha.codigo_referencia,
    tipo: linha.tipo,
    atividadePaiId: linha.atividade_pai_id,
    titulo: linha.titulo,
    descricao: linha.descricao,
    prioridade: linha.prioridade,
    status: linha.status,
    responsavel: linha.responsavel,
    prazo: linha.prazo,
    dataConclusao: linha.data_conclusao,
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

function validarUuid(valor: unknown, campo: string): string {
  const uuid = String(valor ?? '').trim();
  const regexUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!regexUuid.test(uuid)) {
    throw new ApiErro(`Campo deve ser um UUID válido: ${campo}`, 400);
  }

  return uuid;
}

function normalizarNomeRaia(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function validarTipoAtividade(valor: unknown, campo: string): Atividade['tipo'] {
  const tipo = String(valor ?? '').trim().toUpperCase() as Atividade['tipo'];

  if (tipo !== 'HU' && tipo !== 'BUGFIX' && tipo !== 'HOTFIX') {
    throw new ApiErro(`Campo deve ser um tipo de atividade válido: ${campo}`, 400);
  }

  return tipo;
}

function validarRaiasPadrao(valor: unknown): RaiaPadraoProjeto[] {
  if (!Array.isArray(valor) || valor.length === 0) {
    throw new ApiErro('Selecione ao menos uma raia padrão para o projeto.', 400);
  }

  const raias = valor.map((item) => String(item ?? '').trim().toUpperCase()) as RaiaPadraoProjeto[];
  const permitidas = new Set<RaiaPadraoProjeto>(Object.keys(RAIAS_PADRAO_PROJETO) as RaiaPadraoProjeto[]);

  if (raias.some((raia) => !permitidas.has(raia))) {
    throw new ApiErro('A lista de raias padrão do projeto possui valores inválidos.', 400);
  }

  return [...new Set(raias)];
}

function formatarCodigoReferencia(prefixo: 'HU' | 'BG' | 'HF', sequencia: number): string {
  return `${prefixo}${String(sequencia).padStart(5, '0')}`;
}

async function buscarRaiaPorId(raiaId: string): Promise<RaiaBanco> {
  const raia = await obter<RaiaBanco>(`SELECT * FROM ${TABELAS.raias} WHERE id = ?`, [raiaId]);

  if (!raia) {
    throw new ApiErro('Raia nao encontrada.', 404);
  }

  return raia;
}

async function gerarCodigoReferencia(tipo: Atividade['tipo']): Promise<string> {
  const prefixo = tipo === 'BUGFIX' ? 'BG' : tipo === 'HOTFIX' ? 'HF' : 'HU';
  const codigos = await listar<CodigoReferenciaBanco>(
    `SELECT codigo_referencia FROM ${TABELAS.atividades} WHERE codigo_referencia LIKE ? ORDER BY codigo_referencia DESC LIMIT 1`,
    [`${prefixo}%`],
  );

  const ultimoCodigo = codigos[0]?.codigo_referencia?.trim().toUpperCase() ?? '';
  const proximaSequencia = ultimoCodigo ? Number(ultimoCodigo.slice(2)) + 1 : 1;
  return formatarCodigoReferencia(prefixo, proximaSequencia);
}

function statusPorRaia(nomeRaia: string, statusAtual: Atividade['status']): Atividade['status'] {
  const nomeNormalizado = normalizarNomeRaia(nomeRaia);

  if (nomeNormalizado === 'concluidas') {
    return 'CONCLUIDA';
  }

  if (nomeNormalizado === 'backlog') {
    return 'BACKLOG';
  }

  if (statusAtual === 'CONCLUIDA') {
    return 'EM_ANDAMENTO';
  }

  return statusAtual;
}

function dataConclusaoPorRaia(nomeRaia: string, dataAtual: string | null): string | null {
  return normalizarNomeRaia(nomeRaia) === 'concluidas' ? dataAtual ?? agoraIso() : null;
}

async function validarAtividadePai(
  projetoId: string,
  tipo: Atividade['tipo'],
  atividadePaiId: string | null,
  atividadeAtualId?: string,
): Promise<string | null> {
  if (tipo === 'HU') {
    return null;
  }

  if (!atividadePaiId) {
    throw new ApiErro('BUGFIX e HOTFIX devem estar vinculados a uma HU.', 400);
  }

  const atividadePai = await obter<
    AtividadeBanco & {
      nome_raia: string;
    }
  >(
    `SELECT a.*, r.nome AS nome_raia
     FROM ${TABELAS.atividades} a
     JOIN ${TABELAS.raias} r ON r.id = a.raia_id
     WHERE a.id = ? AND a.projeto_id = ?`,
    [atividadePaiId, projetoId],
  );

  if (!atividadePai) {
    throw new ApiErro('HU vinculada nao encontrada no projeto.', 404);
  }

  if (atividadeAtualId && atividadePai.id === atividadeAtualId) {
    throw new ApiErro('Uma atividade nao pode ser vinculada a ela mesma.', 400);
  }

  if (atividadePai.tipo !== 'HU') {
    throw new ApiErro('A atividade vinculada deve ser uma HU.', 400);
  }

  const nomeRaiaPai = normalizarNomeRaia(atividadePai.nome_raia);

  if (tipo === 'BUGFIX' && nomeRaiaPai !== 'teste') {
    throw new ApiErro('BUGFIX deve ser vinculado a uma HU que esteja na raia Teste.', 400);
  }

  if (tipo === 'HOTFIX' && nomeRaiaPai !== 'concluidas') {
    throw new ApiErro('HOTFIX deve ser vinculado a uma HU que esteja na raia Concluídas.', 400);
  }

  return atividadePaiId;
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
    const usuarios = await listar<Usuario>(`SELECT id, nome, email, iniciais FROM ${TABELAS.usuarios} ORDER BY nome`);
    res.json(usuarios);
  }),
);

roteador.get(
  '/projetos',
  tratarAssincrono(async (_req, res) => {
    const projetos = await listar<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} ORDER BY principal DESC, atualizado_em DESC`);
    res.json(projetos.map(mapearProjeto));
  }),
);

roteador.get(
  '/projetos/:id',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.id, 'id');
    const projeto = await obter<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} WHERE id = ?`, [projetoId]);
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
    const raiasPadrao = validarRaiasPadrao(dados.raiasPadrao);

    const agora = agoraIso();
    const id = randomUUID();

    await transacao(async () => {
      await executar(
        `INSERT INTO ${TABELAS.projetos} (id, nome, descricao, cor, principal, status, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, 0, 'ATIVO', ?, ?)`,
        [id, String(dados.nome).trim(), String(dados.descricao).trim(), dados.cor ?? null, agora, agora],
      );

      for (let indice = 0; indice < raiasPadrao.length; indice += 1) {
        await executar(
          `INSERT INTO ${TABELAS.raias} (id, projeto_id, nome, ordem, cor, criado_em, atualizado_em)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`,
          [randomUUID(), id, RAIAS_PADRAO_PROJETO[raiasPadrao[indice]], indice + 1, agora, agora],
        );
      }
    });

    const projeto = await obter<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} WHERE id = ?`, [id]);
    res.status(201).json(mapearProjeto(projeto as ProjetoBanco));
  }),
);

roteador.put(
  '/projetos/:id',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.id, 'id');
    const projetoExistente = await obter<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} WHERE id = ?`, [projetoId]);
    if (!projetoExistente) {
      throw new ApiErro('Projeto nao encontrado.', 404);
    }

    const dados = req.body as AtualizarProjetoPayload;
    const nome = String(dados.nome ?? projetoExistente.nome).trim();
    const descricao = String(dados.descricao ?? projetoExistente.descricao).trim();
    const cor = dados.cor ?? projetoExistente.cor;

    await executar(`UPDATE ${TABELAS.projetos} SET nome = ?, descricao = ?, cor = ?, atualizado_em = ? WHERE id = ?`, [
      nome,
      descricao,
      cor,
      agoraIso(),
      projetoId,
    ]);

    const atualizado = await obter<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} WHERE id = ?`, [projetoId]);
    res.json(mapearProjeto(atualizado as ProjetoBanco));
  }),
);

roteador.patch(
  '/projetos/:id/principal',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.id, 'id');
    const projetoExistente = await obter<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} WHERE id = ?`, [projetoId]);
    if (!projetoExistente) {
      throw new ApiErro('Projeto nao encontrado.', 404);
    }

    await transacao(async () => {
      await executar(`UPDATE ${TABELAS.projetos} SET principal = 0`);
      await executar(`UPDATE ${TABELAS.projetos} SET principal = 1, atualizado_em = ? WHERE id = ?`, [agoraIso(), projetoId]);
    });

    const projeto = await obter<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} WHERE id = ?`, [projetoId]);
    res.json(mapearProjeto(projeto as ProjetoBanco));
  }),
);

roteador.delete(
  '/projetos/:id',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.id, 'id');
    const projeto = await obter<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} WHERE id = ?`, [projetoId]);
    if (!projeto) {
      throw new ApiErro('Projeto nao encontrado.', 404);
    }

    await executar(`DELETE FROM ${TABELAS.projetos} WHERE id = ?`, [projetoId]);

    const principalAtual = await obter<IdApenas>(`SELECT id FROM ${TABELAS.projetos} WHERE principal = 1 LIMIT 1`);
    if (!principalAtual) {
      const primeiroProjeto = await obter<IdApenas>(`SELECT id FROM ${TABELAS.projetos} ORDER BY atualizado_em DESC LIMIT 1`);
      if (primeiroProjeto) {
        await executar(`UPDATE ${TABELAS.projetos} SET principal = 1 WHERE id = ?`, [primeiroProjeto.id]);
      }
    }

    res.status(204).send();
  }),
);

roteador.get(
  '/raias',
  tratarAssincrono(async (_req, res) => {
    const raias = await listar<RaiaBanco>(`SELECT * FROM ${TABELAS.raias} ORDER BY projeto_id, ordem`);
    res.json(raias.map(mapearRaia));
  }),
);

roteador.get(
  '/projetos/:projetoId/raias',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.projetoId, 'projetoId');
    const raias = await listar<RaiaBanco>(`SELECT * FROM ${TABELAS.raias} WHERE projeto_id = ? ORDER BY ordem`, [projetoId]);
    res.json(raias.map(mapearRaia));
  }),
);

roteador.put(
  '/projetos/:projetoId/raias/reordenar',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.projetoId, 'projetoId');
    const dados = req.body as ReordenarRaiasPayload;
    const raias = Array.isArray(dados.raias) ? dados.raias.map((raia, indice) => ({ id: validarUuid(raia.id, `raias[${indice}].id`) })) : [];

    await transacao(async () => {
      for (let indice = 0; indice < raias.length; indice += 1) {
        await executar(`UPDATE ${TABELAS.raias} SET ordem = ?, atualizado_em = ? WHERE id = ? AND projeto_id = ?`, [
          indice + 1,
          agoraIso(),
          raias[indice].id,
          projetoId,
        ]);
      }
    });

    const resultado = await listar<RaiaBanco>(`SELECT * FROM ${TABELAS.raias} WHERE projeto_id = ? ORDER BY ordem`, [projetoId]);
    res.json(resultado.map(mapearRaia));
  }),
);

roteador.get(
  '/atividades',
  tratarAssincrono(async (_req, res) => {
    const atividades = await listar<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} ORDER BY projeto_id, raia_id, ordem`);
    res.json(atividades.map(mapearAtividade));
  }),
);

roteador.get(
  '/projetos/:projetoId/atividades',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.projetoId, 'projetoId');
    const atividades = await listar<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE projeto_id = ? ORDER BY ordem`, [projetoId]);
    res.json(atividades.map(mapearAtividade));
  }),
);

roteador.get(
  '/atividades/:id',
  tratarAssincrono(async (req, res) => {
    const atividadeId = validarUuid(req.params.id, 'id');
    const atividade = await obter<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE id = ?`, [atividadeId]);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }
    res.json(mapearAtividade(atividade));
  }),
);

roteador.post(
  '/projetos/:projetoId/atividades',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.projetoId, 'projetoId');
    const dados = req.body as CriarAtividadePayload;
    const raiaId = validarUuid(dados.raiaId, 'raiaId');
    const tipo = validarTipoAtividade(dados.tipo, 'tipo');
    validarObrigatorio(dados.raiaId, 'raiaId');
    validarObrigatorio(dados.tipo, 'tipo');
    validarObrigatorio(dados.titulo, 'titulo');
    validarObrigatorio(dados.descricao, 'descricao');
    validarObrigatorio(dados.prioridade, 'prioridade');
    validarObrigatorio(dados.status, 'status');
    validarObrigatorio(dados.responsavel, 'responsavel');
    validarObrigatorio(dados.prazo, 'prazo');

    const raiaDestino = await buscarRaiaPorId(raiaId);
    const atividadePaiId = await validarAtividadePai(
      projetoId,
      tipo,
      dados.atividadePaiId ? validarUuid(dados.atividadePaiId, 'atividadePaiId') : null,
    );
    const codigoReferencia = await gerarCodigoReferencia(tipo);
    const status = statusPorRaia(raiaDestino.nome, dados.status);
    const dataConclusao = dataConclusaoPorRaia(raiaDestino.nome, null);

    const linhaOrdem = await obter<ProximaOrdemLinha>(`SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem FROM ${TABELAS.atividades} WHERE raia_id = ?`, [
      raiaId,
    ]);

    const id = randomUUID();
    await executar(
      `INSERT INTO ${TABELAS.atividades} (
        id, projeto_id, raia_id, codigo_referencia, tipo, atividade_pai_id, titulo, descricao, prioridade, status,
        responsavel, prazo, data_conclusao, etiquetas_json, checklist_json, comentarios_json,
        ordem, criado_em, atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projetoId,
        raiaId,
        codigoReferencia,
        tipo,
        atividadePaiId,
        String(dados.titulo).trim(),
        String(dados.descricao).trim(),
        dados.prioridade,
        status,
        dados.responsavel,
        dados.prazo,
        dataConclusao,
        JSON.stringify(dados.etiquetas ?? []),
        JSON.stringify(dados.checklist ?? []),
        JSON.stringify(dados.comentarios ?? []),
        linhaOrdem?.proxima_ordem ?? 1,
        agoraIso(),
        agoraIso(),
      ],
    );

    const atividade = await obter<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE id = ?`, [id]);
    res.status(201).json(mapearAtividade(atividade as AtividadeBanco));
  }),
);

roteador.put(
  '/atividades/:id',
  tratarAssincrono(async (req, res) => {
    const atividadeId = validarUuid(req.params.id, 'id');
    const atividade = await obter<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE id = ?`, [atividadeId]);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }

    const dados = req.body as AtualizarAtividadePayload;
    const novaRaiaId = dados.raiaId ? validarUuid(dados.raiaId, 'raiaId') : atividade.raia_id;
    const tipo = dados.tipo ? validarTipoAtividade(dados.tipo, 'tipo') : atividade.tipo;
    const raiaDestino = await buscarRaiaPorId(novaRaiaId);
    const atividadePaiId = await validarAtividadePai(
      atividade.projeto_id,
      tipo,
      dados.atividadePaiId === undefined
        ? atividade.atividade_pai_id
        : dados.atividadePaiId
          ? validarUuid(dados.atividadePaiId, 'atividadePaiId')
          : null,
      atividade.id,
    );
    const status = statusPorRaia(raiaDestino.nome, (dados.status ?? atividade.status) as Atividade['status']);
    const dataConclusao = dataConclusaoPorRaia(raiaDestino.nome, atividade.data_conclusao);

    await executar(
      `UPDATE ${TABELAS.atividades} SET
        raia_id = ?,
        tipo = ?,
        atividade_pai_id = ?,
        titulo = ?,
        descricao = ?,
        prioridade = ?,
        status = ?,
        responsavel = ?,
        prazo = ?,
        data_conclusao = ?,
        etiquetas_json = ?,
        checklist_json = ?,
        comentarios_json = ?,
        atualizado_em = ?
      WHERE id = ?`,
      [
        novaRaiaId,
        tipo,
        atividadePaiId,
        String(dados.titulo ?? atividade.titulo).trim(),
        String(dados.descricao ?? atividade.descricao).trim(),
        dados.prioridade ?? atividade.prioridade,
        status,
        dados.responsavel ?? atividade.responsavel,
        dados.prazo ?? atividade.prazo,
        dataConclusao,
        JSON.stringify(dados.etiquetas ?? jsonSeguroParse(atividade.etiquetas_json, [])),
        JSON.stringify(dados.checklist ?? jsonSeguroParse(atividade.checklist_json, [])),
        JSON.stringify(dados.comentarios ?? jsonSeguroParse(atividade.comentarios_json, [])),
        agoraIso(),
        atividadeId,
      ],
    );

    const atualizada = await obter<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE id = ?`, [atividadeId]);
    res.json(mapearAtividade(atualizada as AtividadeBanco));
  }),
);

roteador.patch(
  '/atividades/:id/checklist',
  tratarAssincrono(async (req, res) => {
    const atividadeId = validarUuid(req.params.id, 'id');
    const dados = req.body as AtualizarChecklistPayload;

    await executar(`UPDATE ${TABELAS.atividades} SET checklist_json = ?, atualizado_em = ? WHERE id = ?`, [
      JSON.stringify(Array.isArray(dados.checklist) ? dados.checklist : []),
      agoraIso(),
      atividadeId,
    ]);

    const atividade = await obter<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE id = ?`, [atividadeId]);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }

    res.json(mapearAtividade(atividade));
  }),
);

roteador.post(
  '/atividades/:id/comentarios',
  tratarAssincrono(async (req, res) => {
    const atividadeId = validarUuid(req.params.id, 'id');
    const dados = req.body as AdicionarComentarioPayload;
    validarObrigatorio(dados.texto, 'texto');

    const atividade = await obter<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE id = ?`, [atividadeId]);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }

    const usuarioIdComentario = dados.usuarioId
      ? validarUuid(dados.usuarioId, 'usuarioId')
      : validarUuid(req.autenticacao?.usuarioId, 'usuarioId');

    const comentarios = jsonSeguroParse<Comentario[]>(atividade.comentarios_json, []);
    comentarios.push({
      id: randomUUID(),
      atividadeId,
      usuarioId: usuarioIdComentario,
      texto: String(dados.texto).trim(),
      criadoEm: agoraIso(),
    });

    await executar(`UPDATE ${TABELAS.atividades} SET comentarios_json = ?, atualizado_em = ? WHERE id = ?`, [
      JSON.stringify(comentarios),
      agoraIso(),
      atividadeId,
    ]);

    const atualizada = await obter<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE id = ?`, [atividadeId]);
    res.json(mapearAtividade(atualizada as AtividadeBanco));
  }),
);

roteador.delete(
  '/atividades/:id',
  tratarAssincrono(async (req, res) => {
    const atividadeId = validarUuid(req.params.id, 'id');
    const atividade = await obter<
      AtividadeBanco & {
        nome_raia: string;
      }
    >(
      `SELECT a.*, r.nome AS nome_raia
       FROM ${TABELAS.atividades} a
       JOIN ${TABELAS.raias} r ON r.id = a.raia_id
       WHERE a.id = ?`,
      [atividadeId],
    );
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }

    if (atividade.data_conclusao || normalizarNomeRaia(atividade.nome_raia) === 'concluidas') {
      throw new ApiErro('Atividades concluídas não podem ser excluídas.', 400);
    }

    await executar(`DELETE FROM ${TABELAS.atividades} WHERE id = ?`, [atividadeId]);

    const atividadesRaia = await listar<IdApenas>(`SELECT id FROM ${TABELAS.atividades} WHERE raia_id = ? ORDER BY ordem`, [atividade.raia_id]);
    for (let indice = 0; indice < atividadesRaia.length; indice += 1) {
      await executar(`UPDATE ${TABELAS.atividades} SET ordem = ?, atualizado_em = ? WHERE id = ?`, [
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
    const raiaId = validarUuid(req.params.raiaId, 'raiaId');
    const dados = req.body as ReordenarAtividadesPayload;
    const atividades = Array.isArray(dados.atividades)
      ? dados.atividades.map((atividade, indice) => ({ id: validarUuid(atividade.id, `atividades[${indice}].id`) }))
      : [];

    await transacao(async () => {
      for (let indice = 0; indice < atividades.length; indice += 1) {
        await executar(`UPDATE ${TABELAS.atividades} SET ordem = ?, atualizado_em = ? WHERE id = ? AND raia_id = ?`, [
          indice + 1,
          agoraIso(),
          atividades[indice].id,
          raiaId,
        ]);
      }
    });

    const resultado = await listar<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE raia_id = ? ORDER BY ordem`, [raiaId]);
    res.json(resultado.map(mapearAtividade));
  }),
);
