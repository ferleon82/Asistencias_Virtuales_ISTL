import { EstadoAsistencia } from '@prisma/client';
import { z } from 'zod';

export const locationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  precision_m: z.coerce.number().int().min(0).optional(),
});

export const listAsistenciasQuerySchema = z.object({
  docente_id: z.string().uuid().optional(),
  horario_id: z.string().uuid().optional(),
  estado: z.nativeEnum(EstadoAsistencia).optional(),
  fecha_inicio: z.coerce.date().optional(),
  fecha_fin: z.coerce.date().optional(),
});

export const asistenciaParamsSchema = z.object({
  id: z.string().uuid('ID de asistencia invalido'),
});

export const justificarAsistenciaSchema = z.object({
  justificacion: z.string().trim().min(10, 'La justificacion debe tener al menos 10 caracteres').max(1000),
});

export type LocationInput = z.infer<typeof locationSchema>;
export type ListAsistenciasQueryInput = z.infer<typeof listAsistenciasQuerySchema>;
export type JustificarAsistenciaInput = z.infer<typeof justificarAsistenciaSchema>;
