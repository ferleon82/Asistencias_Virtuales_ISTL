import { EstadoAsistencia } from '@prisma/client';
import { z } from 'zod';

export const reporteQuerySchema = z
  .object({
    carrera_id: z.string().uuid().optional(),
    materia_id: z.string().uuid().optional(),
    docente_id: z.string().uuid().optional(),
    fecha_inicio: z.coerce.date().optional(),
    fecha_fin: z.coerce.date().optional(),
    ciclo: z.string().trim().min(1).optional(),
    estado: z.nativeEnum(EstadoAsistencia).optional(),
  })
  .refine((data) => !data.fecha_inicio || !data.fecha_fin || data.fecha_inicio <= data.fecha_fin, {
    message: 'La fecha de inicio debe ser anterior o igual a la fecha fin',
    path: ['fecha_fin'],
  });

export type ReporteQueryInput = z.infer<typeof reporteQuerySchema>;
