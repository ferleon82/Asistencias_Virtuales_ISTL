import { z } from 'zod';

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD');

/** Máximo de días por registro: suficiente para vacaciones o feriados encadenados. */
export const MAX_DIAS_POR_RANGO = 31;

export const crearDiasNoLaborablesSchema = z
  .object({
    fecha_inicio: fechaSchema,
    /** Opcional: para registrar varios días seguidos (p. ej. carnaval). */
    fecha_fin: fechaSchema.optional().or(z.literal('').transform(() => undefined)),
    descripcion: z.string().trim().min(3, 'Describa el feriado (por ejemplo, Día de Difuntos)').max(150),
  })
  .refine((data) => !data.fecha_fin || data.fecha_inicio <= data.fecha_fin, {
    message: 'La fecha de inicio debe ser anterior o igual a la fecha fin',
    path: ['fecha_fin'],
  });

export const listarDiasNoLaborablesSchema = z.object({
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
});

export const diaNoLaborableParamsSchema = z.object({
  id: z.string().uuid('ID de día no laborable inválido'),
});

export type CrearDiasNoLaborablesInput = z.infer<typeof crearDiasNoLaborablesSchema>;
export type ListarDiasNoLaborablesInput = z.infer<typeof listarDiasNoLaborablesSchema>;
