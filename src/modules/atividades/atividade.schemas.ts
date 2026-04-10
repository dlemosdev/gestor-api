import { z } from 'zod';

const uuid = z.uuid({ message: 'ID invalido.' });
const textoObrigatorio = (campo: string) => z.string().trim().min(1, { message: `${campo} obrigatorio.` });
const textoOpcional = z.string().trim().min(1).optional();

const tipoAtividade = z.enum(['HU', 'BUGFIX', 'HOTFIX']);
const prioridade = z.enum(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA']);
const statusAtividade = z.enum(['BACKLOG', 'EM_ANDAMENTO', 'BLOQUEADA', 'CONCLUIDA']);

const comentarioSchema = z.object({
  id: uuid.optional(),
  atividadeId: uuid.optional(),
  usuarioId: uuid,
  texto: textoObrigatorio('texto'),
  criadoEm: z.string().optional(),
});

const checklistItemSchema = z.record(z.string(), z.unknown());

export const atividadeIdParamsSchema = z.object({
  id: uuid,
});

export const projetoAtividadesParamsSchema = z.object({
  projetoId: uuid,
});

export const raiaAtividadesParamsSchema = z.object({
  raiaId: uuid,
});

export const criarAtividadeSchema = z.object({
  raiaId: uuid.optional(),
  tipo: tipoAtividade,
  atividadePaiId: uuid.nullish(),
  titulo: textoObrigatorio('titulo'),
  descricao: textoObrigatorio('descricao'),
  descricaoDetalhada: textoOpcional.nullish(),
  prioridade,
  status: statusAtividade.optional(),
  responsavel: textoObrigatorio('responsavel'),
  prazo: textoObrigatorio('prazo'),
  etiquetas: z.array(z.unknown()).optional(),
  checklist: z.array(checklistItemSchema).optional(),
  comentarios: z.array(comentarioSchema).optional(),
});

export const atualizarAtividadeSchema = z.object({
  raiaId: uuid.optional(),
  tipo: tipoAtividade.optional(),
  atividadePaiId: z.union([uuid, z.null()]).optional(),
  titulo: textoOpcional,
  descricao: textoOpcional,
  descricaoDetalhada: textoOpcional.nullish(),
  prioridade: prioridade.optional(),
  status: statusAtividade.optional(),
  responsavel: z.string().trim().min(1).optional(),
  prazo: z.string().trim().min(1).optional(),
  etiquetas: z.array(z.unknown()).optional(),
  checklist: z.array(checklistItemSchema).optional(),
  comentarios: z.array(comentarioSchema).optional(),
});

export const atualizarChecklistSchema = z.object({
  checklist: z.array(checklistItemSchema),
});

export const adicionarComentarioSchema = z.object({
  usuarioId: uuid.optional(),
  texto: textoObrigatorio('texto'),
});

export const reordenarAtividadesSchema = z.object({
  atividades: z.array(z.object({ id: uuid })),
});

