import { randomUUID } from 'node:crypto';

import { executar, listar, obter } from '../../banco/conexao';
import { agoraIso } from '../../util/serializacao';
import {
  AtividadeBanco,
  AtividadeBancoComNomeRaia,
  CodigoReferenciaBanco,
  HistoricoAtividadeBanco,
  IdApenas,
  ProximaOrdemLinha,
} from './atividade.types';

const TABELAS = {
  atividades: 'TB_Atividades',
  historicoAtividades: 'TB_Atividades_Historico',
  raias: 'TB_Raias',
} as const;

export class AtividadeRepository {
  listarTodas(): Promise<AtividadeBanco[]> {
    return listar<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} ORDER BY projeto_id, raia_id, ordem`);
  }

  listarPorProjeto(projetoId: string): Promise<AtividadeBanco[]> {
    return listar<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE projeto_id = ? ORDER BY ordem`, [projetoId]);
  }

  buscarPorId(atividadeId: string): Promise<AtividadeBanco | null> {
    return obter<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE id = ?`, [atividadeId]);
  }

  listarHistorico(atividadeId: string): Promise<HistoricoAtividadeBanco[]> {
    return listar<HistoricoAtividadeBanco>(
      `SELECT * FROM ${TABELAS.historicoAtividades} WHERE atividade_id = ? ORDER BY criado_em DESC`,
      [atividadeId],
    );
  }

  buscarAtividadeComNomeRaia(atividadeId: string): Promise<AtividadeBancoComNomeRaia | null> {
    return obter<AtividadeBancoComNomeRaia>(
      `SELECT a.*, r.nome AS nome_raia
       FROM ${TABELAS.atividades} a
       JOIN ${TABELAS.raias} r ON r.id = a.raia_id
       WHERE a.id = ?`,
      [atividadeId],
    );
  }

  buscarAtividadePaiNoProjeto(atividadePaiId: string, projetoId: string): Promise<AtividadeBancoComNomeRaia | null> {
    return obter<AtividadeBancoComNomeRaia>(
      `SELECT a.*, r.nome AS nome_raia
       FROM ${TABELAS.atividades} a
       JOIN ${TABELAS.raias} r ON r.id = a.raia_id
       WHERE a.id = ? AND a.projeto_id = ?`,
      [atividadePaiId, projetoId],
    );
  }

  async registrarHistoricoAtividade(
    atividadeId: string,
    projetoId: string,
    tipo: HistoricoAtividadeBanco['tipo'],
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

  async gerarCodigoReferencia(prefixo: 'HU' | 'BG' | 'HF'): Promise<string> {
    const codigos = await listar<CodigoReferenciaBanco>(
      `SELECT codigo_referencia FROM ${TABELAS.atividades} WHERE codigo_referencia LIKE ? ORDER BY codigo_referencia DESC LIMIT 1`,
      [`${prefixo}%`],
    );
    const ultimoCodigo = codigos[0]?.codigo_referencia?.trim().toUpperCase() ?? '';
    const proximaSequencia = ultimoCodigo ? Number(ultimoCodigo.slice(2)) + 1 : 1;
    return `${prefixo}${String(proximaSequencia).padStart(5, '0')}`;
  }

  buscarProximaOrdemRaia(raiaId: string): Promise<ProximaOrdemLinha | null> {
    return obter<ProximaOrdemLinha>(
      `SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem FROM ${TABELAS.atividades} WHERE raia_id = ?`,
      [raiaId],
    );
  }

  async criar(params: {
    id: string;
    projetoId: string;
    raiaId: string;
    codigoReferencia: string;
    tipo: AtividadeBanco['tipo'];
    atividadePaiId: string | null;
    titulo: string;
    descricao: string;
    descricaoDetalhada: string | null;
    prioridade: AtividadeBanco['prioridade'];
    status: AtividadeBanco['status'];
    responsavel: string;
    prazo: string;
    dataConclusao: string | null;
    etiquetasJson: string;
    checklistJson: string;
    comentariosJson: string;
    ordem: number;
  }): Promise<void> {
    const agora = agoraIso();
    await executar(
      `INSERT INTO ${TABELAS.atividades} (
        id, projeto_id, raia_id, codigo_referencia, tipo, atividade_pai_id, titulo, descricao, descricao_detalhada, prioridade, status,
        responsavel, prazo, data_conclusao, etiquetas_json, checklist_json, comentarios_json,
        ordem, criado_em, atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.projetoId,
        params.raiaId,
        params.codigoReferencia,
        params.tipo,
        params.atividadePaiId,
        params.titulo,
        params.descricao,
        params.descricaoDetalhada,
        params.prioridade,
        params.status,
        params.responsavel,
        params.prazo,
        params.dataConclusao,
        params.etiquetasJson,
        params.checklistJson,
        params.comentariosJson,
        params.ordem,
        agora,
        agora,
      ],
    );
  }

  async atualizar(
    atividadeId: string,
    params: {
      raiaId: string;
      tipo: AtividadeBanco['tipo'];
      atividadePaiId: string | null;
      titulo: string;
      descricao: string;
      descricaoDetalhada: string | null;
      prioridade: AtividadeBanco['prioridade'];
      status: AtividadeBanco['status'];
      responsavel: string;
      prazo: string;
      dataConclusao: string | null;
      etiquetasJson: string;
      checklistJson: string;
      comentariosJson: string;
    },
  ): Promise<void> {
    await executar(
      `UPDATE ${TABELAS.atividades} SET
        raia_id = ?,
        tipo = ?,
        atividade_pai_id = ?,
        titulo = ?,
        descricao = ?,
        descricao_detalhada = ?,
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
        params.raiaId,
        params.tipo,
        params.atividadePaiId,
        params.titulo,
        params.descricao,
        params.descricaoDetalhada,
        params.prioridade,
        params.status,
        params.responsavel,
        params.prazo,
        params.dataConclusao,
        params.etiquetasJson,
        params.checklistJson,
        params.comentariosJson,
        agoraIso(),
        atividadeId,
      ],
    );
  }

  async atualizarChecklist(atividadeId: string, checklistJson: string): Promise<void> {
    await executar(`UPDATE ${TABELAS.atividades} SET checklist_json = ?, atualizado_em = ? WHERE id = ?`, [
      checklistJson,
      agoraIso(),
      atividadeId,
    ]);
  }

  async atualizarComentarios(atividadeId: string, comentariosJson: string): Promise<void> {
    await executar(`UPDATE ${TABELAS.atividades} SET comentarios_json = ?, atualizado_em = ? WHERE id = ?`, [
      comentariosJson,
      agoraIso(),
      atividadeId,
    ]);
  }

  async excluir(atividadeId: string): Promise<void> {
    await executar(`DELETE FROM ${TABELAS.atividades} WHERE id = ?`, [atividadeId]);
  }

  listarIdsPorRaia(raiaId: string): Promise<IdApenas[]> {
    return listar<IdApenas>(`SELECT id FROM ${TABELAS.atividades} WHERE raia_id = ? ORDER BY ordem`, [raiaId]);
  }

  async atualizarOrdemAtividade(atividadeId: string, ordem: number): Promise<void> {
    await executar(`UPDATE ${TABELAS.atividades} SET ordem = ?, atualizado_em = ? WHERE id = ?`, [ordem, agoraIso(), atividadeId]);
  }

  async reordenarPorRaia(raiaId: string, atividades: Array<{ id: string }>): Promise<void> {
    for (let indice = 0; indice < atividades.length; indice += 1) {
      await executar(`UPDATE ${TABELAS.atividades} SET ordem = ?, atualizado_em = ? WHERE id = ? AND raia_id = ?`, [
        indice + 1,
        agoraIso(),
        atividades[indice].id,
        raiaId,
      ]);
    }
  }

  listarPorRaia(raiaId: string): Promise<AtividadeBanco[]> {
    return listar<AtividadeBanco>(`SELECT * FROM ${TABELAS.atividades} WHERE raia_id = ? ORDER BY ordem`, [raiaId]);
  }
}

