import { EstadoAsistencia } from '@prisma/client';
import { z } from 'zod';

export const ESTADO_SIN_SALIDA = 'sin_salida';

export const reporteQuerySchema = z
  .object({
    tipo: z.enum(['docente', 'administrativa']).default('docente'),
    carrera_id: z.string().uuid().optional(),
    materia_id: z.string().uuid().optional(),
    periodo_academico_id: z.string().uuid().optional(),
    docente_id: z.string().uuid().optional(),
    fecha_inicio: z.coerce.date().optional(),
    fecha_fin: z.coerce.date().optional(),
    ciclo: z.coerce.number().int().min(1).max(5).optional(),
    /** `sin_salida`: marcaciones con entrada cuya ventana de salida terminó sin marcarla. */
    estado: z.union([z.nativeEnum(EstadoAsistencia), z.literal(ESTADO_SIN_SALIDA)]).optional(),
  })
  .refine((data) => !data.fecha_inicio || !data.fecha_fin || data.fecha_inicio <= data.fecha_fin, {
    message: 'La fecha de inicio debe ser anterior o igual a la fecha fin',
    path: ['fecha_fin'],
  });

export type ReporteQueryInput = z.infer<typeof reporteQuerySchema>;
