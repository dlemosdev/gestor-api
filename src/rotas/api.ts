import { randomUUID } from 'node:crypto';

import express, { NextFunction, Request, Response } from 'express';

import { executar, listar, obter, transacao } from '../banco/conexao';
import {
  AdicionarComentarioPayload,
  Atividade,
  AtualizarStatusProjetoPayload,
  AtualizarAtividadePayload,
  AtualizarChecklistPayload,
  AtualizarProjetoPayload,
  Comentario,
  CriarAtividadePayload,
  CriarProjetoPayload,
  HistoricoAtividade,
  HistoricoProjeto,
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
  status: 'ATIVO' | 'INATIVO' | 'CONCLUIDO';
  data_inicial: string | null;
  data_final: string | null;
  inativado_em: string | null;
  concluido_em: string | null;
  reativado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface HistoricoProjetoBanco {
  id: string;
  projeto_id: string;
  tipo: HistoricoProjeto['tipo'];
  descricao: string;
  criado_em: string;
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

interface HistoricoAtividadeBanco {
  id: string;
  atividade_id: string;
  projeto_id: string;
  tipo: HistoricoAtividade['tipo'];
  descricao: string;
  origem: string | null;
  destino: string | null;
  criado_em: string;
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
  historicoProjetos: 'TB_Projetos_Historico',
  raias: 'TB_Raias',
  atividades: 'TB_Atividades',
  historicoAtividades: 'TB_Atividades_Historico',
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
    principal: Boolean(linha.principal),
    status: linha.status,
    dataInicial: linha.data_inicial,
    dataFinal: linha.data_final,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    inativadoEm: linha.inativado_em,
    concluidoEm: linha.concluido_em,
    reativadoEm: linha.reativado_em,
  };
}

function mapearHistoricoProjeto(linha: HistoricoProjetoBanco): HistoricoProjeto {
  return {
    id: linha.id,
    projetoId: linha.projeto_id,
    tipo: linha.tipo,
    descricao: linha.descricao,
    criadoEm: linha.criado_em,
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

function mapearHistoricoAtividade(linha: HistoricoAtividadeBanco): HistoricoAtividade {
  return {
    id: linha.id,
    atividadeId: linha.atividade_id,
    projetoId: linha.projeto_id,
    tipo: linha.tipo,
    descricao: linha.descricao,
    origem: linha.origem,
    destino: linha.destino,
    criadoEm: linha.criado_em,
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

function validarStatusProjeto(valor: unknown, campo: string): Projeto['status'] {
  const status = String(valor ?? '')
    .trim()
    .toUpperCase() as Projeto['status'];

  if (status !== 'ATIVO' && status !== 'INATIVO' && status !== 'CONCLUIDO') {
    throw new ApiErro(`Campo deve ser um status de projeto válido: ${campo}`, 400);
  }

  return status;
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

async function buscarProjetoPorId(projetoId: string): Promise<ProjetoBanco> {
  const projeto = await obter<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} WHERE id = ?`, [projetoId]);

  if (!projeto) {
    throw new ApiErro('Projeto nao encontrado.', 404);
  }

  return projeto;
}

async function registrarHistoricoProjeto(projetoId: string, tipo: HistoricoProjeto['tipo'], descricao: string, criadoEm = agoraIso()): Promise<void> {
  await executar(
    `INSERT INTO ${TABELAS.historicoProjetos} (id, projeto_id, tipo, descricao, criado_em)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), projetoId, tipo, descricao, criadoEm],
  );
}

async function registrarHistoricoAtividade(
  atividadeId: string,
  projetoId: string,
  tipo: HistoricoAtividade['tipo'],
  descricao: string,
  origem: string | null,
  destino: string | null,
  criadoEm = agoraIso(),
): Promise<void> {
  await executar(
    `INSERT INTO ${TABELAS.historicoAtividades} (id, atividade_id, projeto_id, tipo, descricao, origem, destino, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), atividadeId, projetoId, tipo, descricao, origem, destino, criadoEm],
  );
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

function validarTransicaoStatusProjeto(statusAtual: Projeto['status'], novoStatus: Projeto['status']): void {
  if (statusAtual === novoStatus) {
    return;
  }

  if (statusAtual === 'CONCLUIDO') {
    throw new ApiErro('Projetos concluídos não podem ser reativados ou inativados novamente.', 400);
  }

  if (statusAtual === 'ATIVO' && (novoStatus === 'INATIVO' || novoStatus === 'CONCLUIDO')) {
    return;
  }

  if (statusAtual === 'INATIVO' && novoStatus === 'ATIVO') {
    return;
  }

  throw new ApiErro('Transição de status do projeto inválida.', 400);
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
    const projetoAtualizado = await buscarProjetoPorId(projetoId);
    res.json(mapearProjeto(projetoAtualizado));
  }),
);

roteador.get(
  '/projetos/:id/historico',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.id, 'id');
    await buscarProjetoPorId(projetoId);

    const historico = await listar<HistoricoProjetoBanco>(
      `SELECT * FROM ${TABELAS.historicoProjetos} WHERE projeto_id = ? ORDER BY criado_em DESC`,
      [projetoId],
    );

    res.json(historico.map(mapearHistoricoProjeto));
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
        `INSERT INTO ${TABELAS.projetos} (
          id, nome, descricao, cor, principal, status, data_inicial, data_final, inativado_em, concluido_em, reativado_em, criado_em, atualizado_em
        ) VALUES (?, ?, ?, NULL, 0, 'ATIVO', ?, ?, NULL, NULL, NULL, ?, ?)`,
        [id, String(dados.nome).trim(), String(dados.descricao).trim(), dados.dataInicial ?? null, dados.dataFinal ?? null, agora, agora],
      );

      for (let indice = 0; indice < raiasPadrao.length; indice += 1) {
        await executar(
          `INSERT INTO ${TABELAS.raias} (id, projeto_id, nome, ordem, cor, criado_em, atualizado_em)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`,
          [randomUUID(), id, RAIAS_PADRAO_PROJETO[raiasPadrao[indice]], indice + 1, agora, agora],
        );
      }

      await registrarHistoricoProjeto(id, 'CRIADO', 'Projeto criado.', agora);
    });

    const projeto = await buscarProjetoPorId(id);
    res.status(201).json(mapearProjeto(projeto));
  }),
);

roteador.put(
  '/projetos/:id',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.id, 'id');
    const projetoExistente = await buscarProjetoPorId(projetoId);

    const dados = req.body as AtualizarProjetoPayload;
    const nome = String(dados.nome ?? projetoExistente.nome).trim();
    const descricao = String(dados.descricao ?? projetoExistente.descricao).trim();
    const agora = agoraIso();

    await executar(`UPDATE ${TABELAS.projetos} SET nome = ?, descricao = ?, data_inicial = ?, data_final = ?, atualizado_em = ? WHERE id = ?`, [
      nome,
      descricao,
      dados.dataInicial ?? projetoExistente.data_inicial,
      dados.dataFinal ?? projetoExistente.data_final,
      agora,
      projetoId,
    ]);

    await registrarHistoricoProjeto(projetoId, 'ATUALIZADO', 'Dados principais do projeto atualizados.', agora);

    const atualizado = await buscarProjetoPorId(projetoId);
    res.json(mapearProjeto(atualizado));
  }),
);

roteador.patch(
  '/projetos/:id/principal',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.id, 'id');
    const projetoAtual = await buscarProjetoPorId(projetoId);

    if (projetoAtual.status !== 'ATIVO') {
      throw new ApiErro('Somente projetos ativos podem ser definidos como principal.', 400);
    }

    const agora = agoraIso();

    await transacao(async () => {
      await executar(`UPDATE ${TABELAS.projetos} SET principal = 0`);
      await executar(`UPDATE ${TABELAS.projetos} SET principal = 1, atualizado_em = ? WHERE id = ?`, [agora, projetoId]);
      await registrarHistoricoProjeto(projetoId, 'PRINCIPAL_DEFINIDO', 'Projeto definido como principal.', agora);
    });

    const projetoAtualizado = await buscarProjetoPorId(projetoId);
    res.json(mapearProjeto(projetoAtualizado));
  }),
);

roteador.patch(
  '/projetos/:id/status',
  tratarAssincrono(async (req, res) => {
    const projetoId = validarUuid(req.params.id, 'id');
    const projeto = await buscarProjetoPorId(projetoId);
    const dados = req.body as AtualizarStatusProjetoPayload;
    const novoStatus = validarStatusProjeto(dados.status, 'status');

    validarTransicaoStatusProjeto(projeto.status, novoStatus);

    if (novoStatus === projeto.status) {
      res.json(mapearProjeto(projeto));
      return;
    }

    const agora = agoraIso();
    const descricaoHistorico =
      novoStatus === 'INATIVO'
        ? 'Projeto inativado.'
        : novoStatus === 'CONCLUIDO'
          ? 'Projeto concluído.'
          : 'Projeto reativado.';

    await executar(
      `UPDATE ${TABELAS.projetos}
       SET status = ?,
           inativado_em = ?,
           concluido_em = ?,
           reativado_em = ?,
           atualizado_em = ?
       WHERE id = ?`,
      [
        novoStatus,
        novoStatus === 'INATIVO' ? agora : projeto.inativado_em,
        novoStatus === 'CONCLUIDO' ? agora : projeto.concluido_em,
        novoStatus === 'ATIVO' ? agora : projeto.reativado_em,
        agora,
        projetoId,
      ],
    );

    await registrarHistoricoProjeto(
      projetoId,
      novoStatus === 'INATIVO' ? 'INATIVADO' : novoStatus === 'CONCLUIDO' ? 'CONCLUIDO' : 'REATIVADO',
      descricaoHistorico,
      agora,
    );

    const atualizado = await buscarProjetoPorId(projetoId);
    res.json(mapearProjeto(atualizado));
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

roteador.get(
  '/atividades/:id/historico',
  tratarAssincrono(async (req, res) => {
    const atividadeId = validarUuid(req.params.id, 'id');
    const atividade = await obter<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE id = ?`, [atividadeId]);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }

    const historico = await listar<HistoricoAtividadeBanco>(
      `SELECT * FROM ${TABELAS.historicoAtividades} WHERE atividade_id = ? ORDER BY criado_em DESC`,
      [atividadeId],
    );

    res.json(historico.map(mapearHistoricoAtividade));
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

    await registrarHistoricoAtividade(id, projetoId, 'CRIADA', 'Atividade criada.', null, raiaDestino.nome, agoraIso());

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
    const houveMudancaRaia = atividade.raia_id !== novaRaiaId;
    const nomeRaiaOrigem = houveMudancaRaia
      ? (await buscarRaiaPorId(atividade.raia_id)).nome
      : null;
    const agora = agoraIso();

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
        agora,
        atividadeId,
      ],
    );

    if (houveMudancaRaia) {
      await registrarHistoricoAtividade(
        atividadeId,
        atividade.projeto_id,
        'MOVIDA_RAIA',
        `Atividade movida de ${nomeRaiaOrigem} para ${raiaDestino.nome}.`,
        nomeRaiaOrigem,
        raiaDestino.nome,
        agora,
      );
    }

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
