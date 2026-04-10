import {
  AdicionarComentarioPayload,
  Atividade,
  AtualizarAtividadePayload,
  AtualizarChecklistPayload,
  Comentario,
  CriarAtividadePayload,
  HistoricoAtividade,
  ReordenarAtividadesPayload,
} from '../../tipos/dominio';
import { jsonSeguroParse } from '../../util/serializacao';

export interface AtividadeBanco {
  id: string;
  projeto_id: string;
  raia_id: string;
  codigo_referencia: string;
  tipo: Atividade['tipo'];
  atividade_pai_id: string | null;
  titulo: string;
  descricao: string;
  descricao_detalhada: string | null;
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

export interface HistoricoAtividadeBanco {
  id: string;
  atividade_id: string;
  projeto_id: string;
  tipo: HistoricoAtividade['tipo'];
  descricao: string;
  origem: string | null;
  destino: string | null;
  criado_em: string;
}

export interface IdApenas {
  id: string;
}

export interface CodigoReferenciaBanco {
  codigo_referencia: string;
}

export interface ProximaOrdemLinha {
  proxima_ordem: number;
}

export interface AtividadeBancoComNomeRaia extends AtividadeBanco {
  nome_raia: string;
}

export interface ContextoComentario {
  usuarioIdAutenticado?: string;
}

export function mapearAtividade(linha: AtividadeBanco): Atividade {
  return {
    id: linha.id,
    projetoId: linha.projeto_id,
    raiaId: linha.raia_id,
    codigoReferencia: linha.codigo_referencia,
    tipo: linha.tipo,
    atividadePaiId: linha.atividade_pai_id,
    titulo: linha.titulo,
    descricao: linha.descricao,
    descricaoDetalhada: linha.descricao_detalhada,
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

export function mapearHistoricoAtividade(linha: HistoricoAtividadeBanco): HistoricoAtividade {
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

export type CriarAtividadeInput = CriarAtividadePayload;
export type AtualizarAtividadeInput = AtualizarAtividadePayload;
export type AtualizarChecklistInput = AtualizarChecklistPayload;
export type AdicionarComentarioInput = AdicionarComentarioPayload;
export type ReordenarAtividadesInput = ReordenarAtividadesPayload;
export type ComentarioLista = Comentario[];
