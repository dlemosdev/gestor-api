import { z } from 'zod';

const uuid = z.uuid({ message: 'ID invalido.' });

export const projetoIdParamsSchema = z.object({
  projetoId: uuid,
});

export const raiaIdParamsSchema = z.object({
  raiaId: uuid,
});

export const reordenarRaiasSchema = z.object({
  raias: z.array(z.object({ id: uuid })),
});

