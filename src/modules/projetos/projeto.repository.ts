import { randomUUID } from 'node:crypto';

import { executar, listar, obter } from '../../banco/conexao';
import { agoraIso } from '../../util/serializacao';
import { HistoricoProjeto } from '../../tipos/dominio';
import {
  AtualizarProjetoInput,
  CriarProjetoInput,
  HistoricoProjetoBanco,
  ProjetoBanco,
} from './projeto.types';

const TABELAS = {
  projetos: 'TB_Projetos',
  historicoProjetos: 'TB_Projetos_Historico',
  raias: 'TB_Raias',
} as const;

const RAIAS_PADRAO_PROJETO: Record<CriarProjetoInput['raiasPadrao'][number], string> = {
  BACKLOG: 'Backlog',
  EM_ANDAMENTO: 'Em andamento',
  TESTE: 'Teste',
  AGUARDANDO_PUBLICACAO: 'Aguardando publicação',
  CONCLUIDAS: 'Concluídas',
};

export class ProjetoRepository {
  listarProjetos(): Promise<ProjetoBanco[]> {
    return listar<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} ORDER BY principal DESC, atualizado_em DESC`);
  }

  buscarProjetoPorId(projetoId: string): Promise<ProjetoBanco | null> {
    return obter<ProjetoBanco>(`SELECT * FROM ${TABELAS.projetos} WHERE id = ?`, [projetoId]);
  }

  listarHistorico(projetoId: string): Promise<HistoricoProjetoBanco[]> {
    return listar<HistoricoProjetoBanco>(
      `SELECT * FROM ${TABELAS.historicoProjetos} WHERE projeto_id = ? ORDER BY criado_em DESC`,
      [projetoId],
    );
  }

  async criarProjeto(dados: CriarProjetoInput): Promise<string> {
    const agora = agoraIso();
    const id = randomUUID();

    await executar(
      `INSERT INTO ${TABELAS.projetos} (
        id, nome, descricao, cor, principal, status, data_inicial, data_final, inativado_em, concluido_em, reativado_em, criado_em, atualizado_em
      ) VALUES (?, ?, ?, NULL, 0, 'ATIVO', ?, ?, NULL, NULL, NULL, ?, ?)`,
      [id, dados.nome.trim(), dados.descricao.trim(), dados.dataInicial ?? null, dados.dataFinal ?? null, agora, agora],
    );

    for (let indice = 0; indice < dados.raiasPadrao.length; indice += 1) {
      await executar(
        `INSERT INTO ${TABELAS.raias} (id, projeto_id, nome, ordem, cor, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        [randomUUID(), id, RAIAS_PADRAO_PROJETO[dados.raiasPadrao[indice]], indice + 1, agora, agora],
      );
    }

    await this.registrarHistoricoProjeto(id, 'CRIADO', 'Projeto criado.', agora);

    return id;
  }

  async atualizarProjeto(projetoId: string, projetoAtual: ProjetoBanco, dados: AtualizarProjetoInput): Promise<void> {
    const agora = agoraIso();
    await executar(
      `UPDATE ${TABELAS.projetos} SET nome = ?, descricao = ?, data_inicial = ?, data_final = ?, atualizado_em = ? WHERE id = ?`,
      [
        String(dados.nome ?? projetoAtual.nome).trim(),
        String(dados.descricao ?? projetoAtual.descricao).trim(),
        dados.dataInicial ?? projetoAtual.data_inicial,
        dados.dataFinal ?? projetoAtual.data_final,
        agora,
        projetoId,
      ],
    );

    await this.registrarHistoricoProjeto(projetoId, 'ATUALIZADO', 'Dados principais do projeto atualizados.', agora);
  }

  async definirPrincipal(projetoId: string): Promise<void> {
    const agora = agoraIso();
    await executar(`UPDATE ${TABELAS.projetos} SET principal = 0`);
    await executar(`UPDATE ${TABELAS.projetos} SET principal = 1, atualizado_em = ? WHERE id = ?`, [agora, projetoId]);
    await this.registrarHistoricoProjeto(projetoId, 'PRINCIPAL_DEFINIDO', 'Projeto definido como principal.', agora);
  }

  async atualizarStatus(projetoId: string, projetoAtual: ProjetoBanco, novoStatus: ProjetoBanco['status']): Promise<void> {
    const agora = agoraIso();
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
        novoStatus === 'INATIVO' ? agora : projetoAtual.inativado_em,
        novoStatus === 'CONCLUIDO' ? agora : projetoAtual.concluido_em,
        novoStatus === 'ATIVO' ? agora : projetoAtual.reativado_em,
        agora,
        projetoId,
      ],
    );

    await this.registrarHistoricoProjeto(
      projetoId,
      novoStatus === 'INATIVO' ? 'INATIVADO' : novoStatus === 'CONCLUIDO' ? 'CONCLUIDO' : 'REATIVADO',
      novoStatus === 'INATIVO' ? 'Projeto inativado.' : novoStatus === 'CONCLUIDO' ? 'Projeto concluído.' : 'Projeto reativado.',
      agora,
    );
  }

  async registrarHistoricoProjeto(projetoId: string, tipo: HistoricoProjeto['tipo'], descricao: string, criadoEm = agoraIso()): Promise<void> {
    await executar(
      `INSERT INTO ${TABELAS.historicoProjetos} (id, projeto_id, tipo, descricao, criado_em)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), projetoId, tipo, descricao, criadoEm],
    );
  }
}

