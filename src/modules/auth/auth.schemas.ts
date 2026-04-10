import { z } from 'zod';

const textoObrigatorio = (campo: string) =>
  z.string().trim().min(1, { message: `${campo} obrigatorio.` });

export const loginSchema = z.object({
  email: z.preprocess(
    (valor) => (typeof valor === 'string' ? valor.trim().toLowerCase() : valor),
    z.email({ message: 'Email invalido.' }),
  ),
  senha: textoObrigatorio('senha'),
});

export const validarCodigoSchema = z.object({
  tokenDesafio: textoObrigatorio('tokenDesafio'),
  codigo: z.preprocess(
    (valor) => (typeof valor === 'string' ? valor.replace(/\D/g, '') : valor),
    z.string().length(6, { message: 'Codigo deve conter 6 digitos.' }),
  ),
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type ValidarCodigoSchema = z.infer<typeof validarCodigoSchema>;

