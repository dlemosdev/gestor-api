import { randomUUID } from 'node:crypto';

import { transacao } from '../../banco/conexao';
import { ApiErro } from '../../tipos/erros';
import { jsonSeguroParse, agoraIso } from '../../util/serializacao';
import { ProjetoRepository } from '../projetos/projeto.repository';
import { RaiaService } from '../raias/raia.service';
import { AtividadeRepository } from './atividade.repository';
import {
  AdicionarComentarioInput,
  AtividadeBanco,
  AtividadeBancoComNomeRaia,
  AtualizarAtividadeInput,
  AtualizarChecklistInput,
  ComentarioLista,
  ContextoComentario,
  CriarAtividadeInput,
  ReordenarAtividadesInput,
  mapearAtividade,
  mapearHistoricoAtividade,
} from './atividade.types';

function normalizarNomeRaia(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function statusPorRaia(nomeRaia: string, statusAtual: AtividadeBanco['status']): AtividadeBanco['status'] {
  const nomeNormalizado = normalizarNomeRaia(nomeRaia);
  if (nomeNormalizado === 'concluidas') return 'CONCLUIDA';
  if (nomeNormalizado === 'backlog') return 'BACKLOG';
  if (statusAtual === 'CONCLUIDA') return 'EM_ANDAMENTO';
  return statusAtual;
}

function dataConclusaoPorRaia(nomeRaia: string, dataAtual: string | null): string | null {
  return normalizarNomeRaia(nomeRaia) === 'concluidas' ? dataAtual ?? agoraIso() : null;
}

function prefixoPorTipo(tipo: AtividadeBanco['tipo']): 'HU' | 'BG' | 'HF' {
  return tipo === 'BUGFIX' ? 'BG' : tipo === 'HOTFIX' ? 'HF' : 'HU';
}

export class AtividadeService {
  constructor(
    private readonly atividadeRepository: AtividadeRepository,
    private readonly raiaService: RaiaService,
    private readonly projetoRepository: ProjetoRepository,
  ) {}

  async listarTodas() {
    const atividades = await this.atividadeRepository.listarTodas();
    return atividades.map(mapearAtividade);
  }

  async listarPorProjeto(projetoId: string) {
    await this.garantirProjetoExiste(projetoId);
    const atividades = await this.atividadeRepository.listarPorProjeto(projetoId);
    return atividades.map(mapearAtividade);
  }

  async obterPorId(atividadeId: string) {
    return mapearAtividade(await this.buscarAtividadeOuFalhar(atividadeId));
  }

  async listarHistorico(atividadeId: string) {
    await this.buscarAtividadeOuFalhar(atividadeId);
    const historico = await this.atividadeRepository.listarHistorico(atividadeId);
    return historico.map(mapearHistoricoAtividade);
  }

  async criar(projetoId: string, dados: CriarAtividadeInput) {
    await this.garantirProjetoExiste(projetoId);
    const tipo = dados.tipo;
    const raiaDestino = dados.raiaId
      ? await this.raiaService.buscarRaiaDoProjeto(dados.raiaId, projetoId)
      : await this.raiaService.buscarRaiaBacklogProjeto(projetoId);
    const atividadePaiId = await this.validarAtividadePai(projetoId, tipo, dados.atividadePaiId ?? null);
    const codigoReferencia = await this.atividadeRepository.gerarCodigoReferencia(prefixoPorTipo(tipo));
    const status = statusPorRaia(raiaDestino.nome, (dados.status ?? 'BACKLOG') as AtividadeBanco['status']);
    const dataConclusao = dataConclusaoPorRaia(raiaDestino.nome, null);
    const linhaOrdem = await this.atividadeRepository.buscarProximaOrdemRaia(raiaDestino.id);
    const id = randomUUID();

    await this.atividadeRepository.criar({
      id,
      projetoId,
      raiaId: raiaDestino.id,
      codigoReferencia,
      tipo,
      atividadePaiId,
      titulo: dados.titulo.trim(),
      descricao: dados.descricao.trim(),
      descricaoDetalhada: dados.descricaoDetalhada ? dados.descricaoDetalhada.trim() : null,
      prioridade: dados.prioridade,
      status,
      responsavel: dados.responsavel,
      prazo: dados.prazo,
      dataConclusao,
      etiquetasJson: JSON.stringify(dados.etiquetas ?? []),
      checklistJson: JSON.stringify(dados.checklist ?? []),
      comentariosJson: JSON.stringify(dados.comentarios ?? []),
      ordem: linhaOrdem?.proxima_ordem ?? 1,
    });

    await this.atividadeRepository.registrarHistoricoAtividade(id, projetoId, 'CRIADA', 'Atividade criada.', null, raiaDestino.nome);
    return this.obterPorId(id);
  }

  async atualizar(atividadeId: string, dados: AtualizarAtividadeInput) {
    const atividade = await this.buscarAtividadeOuFalhar(atividadeId);
    const novaRaiaId = dados.raiaId ?? atividade.raia_id;
    const tipo = dados.tipo ?? atividade.tipo;
    const raiaDestino = await this.raiaService.buscarRaiaDoProjeto(novaRaiaId, atividade.projeto_id);
    const atividadePaiId = await this.validarAtividadePai(
      atividade.projeto_id,
      tipo,
      dados.atividadePaiId === undefined ? atividade.atividade_pai_id : dados.atividadePaiId,
      atividade.id,
    );
    const status = statusPorRaia(raiaDestino.nome, (dados.status ?? atividade.status) as AtividadeBanco['status']);
    const dataConclusao = dataConclusaoPorRaia(raiaDestino.nome, atividade.data_conclusao);
    const houveMudancaRaia = atividade.raia_id !== novaRaiaId;
    const nomeRaiaOrigem = houveMudancaRaia
      ? (await this.raiaService.buscarRaiaDoProjeto(atividade.raia_id, atividade.projeto_id)).nome
      : null;

    await this.atividadeRepository.atualizar(atividadeId, {
      raiaId: novaRaiaId,
      tipo,
      atividadePaiId,
      titulo: String(dados.titulo ?? atividade.titulo).trim(),
      descricao: String(dados.descricao ?? atividade.descricao).trim(),
      descricaoDetalhada:
        dados.descricaoDetalhada === undefined
          ? atividade.descricao_detalhada
          : dados.descricaoDetalhada
            ? String(dados.descricaoDetalhada).trim()
            : null,
      prioridade: dados.prioridade ?? atividade.prioridade,
      status,
      responsavel: dados.responsavel ?? atividade.responsavel,
      prazo: dados.prazo ?? atividade.prazo,
      dataConclusao,
      etiquetasJson: JSON.stringify(dados.etiquetas ?? jsonSeguroParse(atividade.etiquetas_json, [])),
      checklistJson: JSON.stringify(dados.checklist ?? jsonSeguroParse(atividade.checklist_json, [])),
      comentariosJson: JSON.stringify(dados.comentarios ?? jsonSeguroParse(atividade.comentarios_json, [])),
    });

    if (houveMudancaRaia) {
      await this.atividadeRepository.registrarHistoricoAtividade(
        atividadeId,
        atividade.projeto_id,
        'MOVIDA_RAIA',
        `Atividade movida de ${nomeRaiaOrigem} para ${raiaDestino.nome}.`,
        nomeRaiaOrigem,
        raiaDestino.nome,
      );
    }

    return this.obterPorId(atividadeId);
  }

  async atualizarChecklist(atividadeId: string, dados: AtualizarChecklistInput) {
    await this.atividadeRepository.atualizarChecklist(atividadeId, JSON.stringify(Array.isArray(dados.checklist) ? dados.checklist : []));
    return this.obterPorId(atividadeId);
  }

  async adicionarComentario(atividadeId: string, dados: AdicionarComentarioInput, contexto: ContextoComentario) {
    const atividade = await this.buscarAtividadeOuFalhar(atividadeId);
    const usuarioIdComentario = dados.usuarioId ?? contexto.usuarioIdAutenticado;
    if (!usuarioIdComentario) {
      throw new ApiErro('Campo deve ser um UUID válido: usuarioId', 400);
    }

    const comentarios = jsonSeguroParse<ComentarioLista>(atividade.comentarios_json, []);
    comentarios.push({
      id: randomUUID(),
      atividadeId,
      usuarioId: usuarioIdComentario,
      texto: String(dados.texto).trim(),
      criadoEm: agoraIso(),
    });

    await this.atividadeRepository.atualizarComentarios(atividadeId, JSON.stringify(comentarios));
    return this.obterPorId(atividadeId);
  }

  async excluir(atividadeId: string) {
    const atividade = await this.atividadeRepository.buscarAtividadeComNomeRaia(atividadeId);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }
    if (atividade.data_conclusao || normalizarNomeRaia(atividade.nome_raia) === 'concluidas') {
      throw new ApiErro('Atividades concluídas não podem ser excluídas.', 400);
    }

    await this.atividadeRepository.excluir(atividadeId);
    const atividadesRaia = await this.atividadeRepository.listarIdsPorRaia(atividade.raia_id);
    for (let indice = 0; indice < atividadesRaia.length; indice += 1) {
      await this.atividadeRepository.atualizarOrdemAtividade(atividadesRaia[indice].id, indice + 1);
    }
  }

  async reordenarPorRaia(raiaId: string, dados: ReordenarAtividadesInput) {
    await this.raiaService.buscarRaiaPorId(raiaId);
    await transacao(() => this.atividadeRepository.reordenarPorRaia(raiaId, dados.atividades));
    const resultado = await this.atividadeRepository.listarPorRaia(raiaId);
    return resultado.map(mapearAtividade);
  }

  private async validarAtividadePai(
    projetoId: string,
    tipo: AtividadeBanco['tipo'],
    atividadePaiId: string | null,
    atividadeAtualId?: string,
  ): Promise<string | null> {
    if (tipo === 'HU') {
      return null;
    }

    if (!atividadePaiId) {
      throw new ApiErro('BUGFIX e HOTFIX devem estar vinculados a uma HU.', 400);
    }

    const atividadePai = await this.atividadeRepository.buscarAtividadePaiNoProjeto(atividadePaiId, projetoId);
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

  private async buscarAtividadeOuFalhar(atividadeId: string): Promise<AtividadeBanco> {
    const atividade = await this.atividadeRepository.buscarPorId(atividadeId);
    if (!atividade) {
      throw new ApiErro('Atividade nao encontrada.', 404);
    }
    return atividade;
  }

  private async garantirProjetoExiste(projetoId: string): Promise<void> {
    const projeto = await this.projetoRepository.buscarProjetoPorId(projetoId);
    if (!projeto) {
      throw new ApiErro('Projeto nao encontrado.', 404);
    }
  }
}

