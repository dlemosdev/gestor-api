import { z } from 'zod';

const uuidParamSchema = z.object({
  id: z.uuid({ message: 'ID invalido.' }),
});

const statusProjetoSchema = z.enum(['ATIVO', 'INATIVO', 'CONCLUIDO']);
const raiaPadraoSchema = z.enum(['BACKLOG', 'EM_ANDAMENTO', 'TESTE', 'AGUARDANDO_PUBLICACAO', 'CONCLUIDAS']);

const textoObrigatorio = (campo: string) =>
  z.string().trim().min(1, { message: `${campo} obrigatorio.` });

const dataOpcional = z.union([z.iso.date(), z.null()]).optional();

export const projetoIdParamsSchema = uuidParamSchema;

export const criarProjetoSchema = z.object({
  nome: textoObrigatorio('nome'),
  descricao: textoObrigatorio('descricao'),
  dataInicial: dataOpcional,
  dataFinal: dataOpcional,
  raiasPadrao: z.array(raiaPadraoSchema).min(1, { message: 'Selecione ao menos uma raia padrao.' }),
});

export const atualizarProjetoSchema = z.object({
  nome: z.string().trim().min(1, { message: 'nome obrigatorio.' }).optional(),
  descricao: z.string().trim().min(1, { message: 'descricao obrigatoria.' }).optional(),
  dataInicial: dataOpcional,
  dataFinal: dataOpcional,
});

export const atualizarStatusProjetoSchema = z.object({
  status: statusProjetoSchema,
});

