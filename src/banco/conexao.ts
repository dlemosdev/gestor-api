import sqlite3 from 'sqlite3';
import path from 'node:path';

const caminhoBanco = path.resolve(__dirname, '..', '..', 'dados.db');
const conexao = new sqlite3.Database(caminhoBanco);

export interface ResultadoExecucao {
  ultimoId: number;
  linhasAfetadas: number;
}

export function executar(comandoSql: string, parametros: unknown[] = []): Promise<ResultadoExecucao> {
  return new Promise((resolver, rejeitar) => {
    conexao.run(comandoSql, parametros as never[], function callback(erro: Error | null) {
      if (erro) {
        rejeitar(erro);
        return;
      }

      resolver({
        ultimoId: this.lastID,
        linhasAfetadas: this.changes,
      });
    });
  });
}

export function obter<T>(comandoSql: string, parametros: unknown[] = []): Promise<T | null> {
  return new Promise((resolver, rejeitar) => {
    conexao.get(comandoSql, parametros as never[], (erro: Error | null, linha: T | undefined) => {
      if (erro) {
        rejeitar(erro);
        return;
      }

      resolver(linha ?? null);
    });
  });
}

export function listar<T>(comandoSql: string, parametros: unknown[] = []): Promise<T[]> {
  return new Promise((resolver, rejeitar) => {
    conexao.all(comandoSql, parametros as never[], (erro: Error | null, linhas: T[]) => {
      if (erro) {
        rejeitar(erro);
        return;
      }

      resolver(linhas);
    });
  });
}

export async function transacao<T>(executarBloco: () => Promise<T>): Promise<T> {
  await executar('BEGIN');

  try {
    const resultado = await executarBloco();
    await executar('COMMIT');
    return resultado;
  } catch (erro) {
    await executar('ROLLBACK');
    throw erro;
  }
}

export { conexao };
