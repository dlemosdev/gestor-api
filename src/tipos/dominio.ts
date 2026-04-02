export interface EtiquetaAtividade {
  nome: string;
  cor: string;
}

export interface ChecklistItem {
  id: string;
  titulo: string;
  concluido: boolean;
}

export interface Comentario {
  id: string;
  atividadeId: string;
  usuarioId: string;
  texto: string;
  criadoEm: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  iniciais: string;
}

export interface Projeto {
  id: string;
  nome: string;
  descricao: string;
  principal: boolean;
  status: 'ATIVO' | 'INATIVO' | 'CONCLUIDO';
  dataInicial: string | null;
  dataFinal: string | null;
  criadoEm: string;
  atualizadoEm: string;
  inativadoEm: string | null;
  concluidoEm: string | null;
  reativadoEm: string | null;
}

export interface HistoricoProjeto {
  id: string;
  projetoId: string;
  tipo: 'CRIADO' | 'ATUALIZADO' | 'INATIVADO' | 'REATIVADO' | 'CONCLUIDO' | 'PRINCIPAL_DEFINIDO';
  descricao: string;
  criadoEm: string;
}

export interface HistoricoAtividade {
  id: string;
  atividadeId: string;
  projetoId: string;
  tipo: 'CRIADA' | 'MOVIDA_RAIA';
  descricao: string;
  origem: string | null;
  destino: string | null;
  criadoEm: string;
}

export type RaiaPadraoProjeto = 'BACKLOG' | 'EM_ANDAMENTO' | 'TESTE' | 'AGUARDANDO_PUBLICACAO' | 'CONCLUIDAS';

export interface Raia {
  id: string;
  projetoId: string;
  nome: string;
  ordem: number;
  cor: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Atividade {
  id: string;
  projetoId: string;
  raiaId: string;
  codigoReferencia: string;
  tipo: 'HU' | 'BUGFIX' | 'HOTFIX';
  atividadePaiId: string | null;
  titulo: string;
  descricao: string;
  descricaoDetalhada: string | null;
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  status: 'BACKLOG' | 'EM_ANDAMENTO' | 'BLOQUEADA' | 'CONCLUIDA';
  responsavel: string;
  prazo: string;
  dataConclusao: string | null;
  etiquetas: EtiquetaAtividade[];
  checklist: ChecklistItem[];
  comentarios: Comentario[];
  ordem: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarProjetoPayload {
  nome: string;
  descricao: string;
  dataInicial?: string | null;
  dataFinal?: string | null;
  raiasPadrao: RaiaPadraoProjeto[];
}

export interface AtualizarProjetoPayload extends Omit<CriarProjetoPayload, 'raiasPadrao'> {}

export interface AtualizarStatusProjetoPayload {
  status: Projeto['status'];
}

export interface ReordenarRaiasPayload {
  raias: Array<{ id: string }>;
}

export interface CriarAtividadePayload {
  raiaId?: string;
  tipo: Atividade['tipo'];
  atividadePaiId?: string | null;
  titulo: string;
  descricao: string;
  descricaoDetalhada?: string | null;
  prioridade: Atividade['prioridade'];
  status?: Atividade['status'];
  responsavel: string;
  prazo: string;
  etiquetas?: EtiquetaAtividade[];
  checklist?: ChecklistItem[];
  comentarios?: Comentario[];
}

export interface AtualizarAtividadePayload extends Partial<CriarAtividadePayload> {}

export interface AtualizarChecklistPayload {
  checklist: ChecklistItem[];
}

export interface AdicionarComentarioPayload {
  texto: string;
  usuarioId?: string;
}

export interface ReordenarAtividadesPayload {
  atividades: Array<{ id: string }>;
}
