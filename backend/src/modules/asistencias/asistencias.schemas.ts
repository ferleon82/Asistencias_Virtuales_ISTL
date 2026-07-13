import { EstadoAsistencia } from '@prisma/client';
import { z } from 'zod';

export const locationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  precision_m: z.coerce.number().int().min(0).optional(),
  foto_base64: z
    .string()
    .regex(/^data:image\/(jpeg|jpg|png);base64,[A-Za-z0-9+/=]+$/, 'La foto debe ser una imagen válida de cámara.')
    .max(900_000, 'La foto de asistencia es demasiado grande.')
    .optional(),
});

export const listAsistenciasQuerySchema = z.object({
  docente_id: z.string().uuid().optional(),
  horario_id: z.string().uuid().optional(),
  estado: z.nativeEnum(EstadoAsistencia).optional(),
  fecha_inicio: z.coerce.date().optional(),
  fecha_fin: z.coerce.date().optional(),
});

export const asistenciaParamsSchema = z.object({
  id: z.string().uuid('ID de asistencia inválido'),
});

export const horarioParamsSchema = z.object({
  horarioId: z.string().uuid('ID de horario inválido'),
});

export const justificarAsistenciaSchema = z.object({
  justificacion: z.string().trim().min(10, 'La justificación debe tener al menos 10 caracteres').max(1000),
});

export type LocationInput = z.infer<typeof locationSchema>;
export type ListAsistenciasQueryInput = z.infer<typeof listAsistenciasQuerySchema>;
export type JustificarAsistenciaInput = z.infer<typeof justificarAsistenciaSchema>;
