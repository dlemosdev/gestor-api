import { Raia } from '../../tipos/dominio';

export interface RaiaBanco {
  id: string;
  projeto_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ReordenarRaiasInput {
  raias: Array<{ id: string }>;
}

export function mapearRaia(linha: RaiaBanco): Raia {
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

