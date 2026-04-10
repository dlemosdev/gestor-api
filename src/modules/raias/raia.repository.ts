import { executar, listar, obter } from '../../banco/conexao';
import { agoraIso } from '../../util/serializacao';
import { RaiaBanco } from './raia.types';

const TABELAS = {
  raias: 'TB_Raias',
} as const;

export class RaiaRepository {
  listarTodas(): Promise<RaiaBanco[]> {
    return listar<RaiaBanco>(`SELECT * FROM ${TABELAS.raias} ORDER BY projeto_id, ordem`);
  }

  listarPorProjeto(projetoId: string): Promise<RaiaBanco[]> {
    return listar<RaiaBanco>(`SELECT * FROM ${TABELAS.raias} WHERE projeto_id = ? ORDER BY ordem`, [projetoId]);
  }

  buscarPorId(raiaId: string): Promise<RaiaBanco | null> {
    return obter<RaiaBanco>(`SELECT * FROM ${TABELAS.raias} WHERE id = ?`, [raiaId]);
  }

  buscarPorIdEProjeto(raiaId: string, projetoId: string): Promise<RaiaBanco | null> {
    return obter<RaiaBanco>(`SELECT * FROM ${TABELAS.raias} WHERE id = ? AND projeto_id = ?`, [raiaId, projetoId]);
  }

  buscarBacklogDoProjeto(projetoId: string): Promise<RaiaBanco | null> {
    return obter<RaiaBanco>(
      `SELECT * FROM ${TABELAS.raias}
       WHERE projeto_id = ? AND LOWER(TRIM(nome)) IN ('backlog')
       ORDER BY ordem
       LIMIT 1`,
      [projetoId],
    );
  }

  async atualizarOrdem(projetoId: string, raias: Array<{ id: string }>): Promise<void> {
    for (let indice = 0; indice < raias.length; indice += 1) {
      await executar(`UPDATE ${TABELAS.raias} SET ordem = ?, atualizado_em = ? WHERE id = ? AND projeto_id = ?`, [
        indice + 1,
        agoraIso(),
        raias[indice].id,
        projetoId,
      ]);
    }
  }
}

