import { HistoricoProjeto, Projeto, RaiaPadraoProjeto } from '../../tipos/dominio';

export interface ProjetoBanco {
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

export interface HistoricoProjetoBanco {
  id: string;
  projeto_id: string;
  tipo: HistoricoProjeto['tipo'];
  descricao: string;
  criado_em: string;
}

export interface CriarProjetoInput {
  nome: string;
  descricao: string;
  dataInicial?: string | null;
  dataFinal?: string | null;
  raiasPadrao: RaiaPadraoProjeto[];
}

export interface AtualizarProjetoInput {
  nome?: string;
  descricao?: string;
  dataInicial?: string | null;
  dataFinal?: string | null;
}

export interface AtualizarStatusProjetoInput {
  status: Projeto['status'];
}

