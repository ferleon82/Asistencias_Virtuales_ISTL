import { DiaSemana, Jornada, Modalidad } from '@prisma/client';
import { z } from 'zod';
import { locationSchema } from '../asistencias/asistencias.schemas';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:mm');

export const horarioAdministrativoParamsSchema = z.object({
  id: z.string().uuid('ID de horario administrativo inválido'),
});

export const horarioAdministrativoQuerySchema = z.object({
  docente_id: z.string().uuid().optional(),
  periodo_academico_id: z.string().uuid().optional(),
  dia_semana: z.nativeEnum(DiaSemana).optional(),
  activo: z.coerce.boolean().optional(),
});

const horarioAdministrativoBaseSchema = z.object({
  docente_id: z.string().uuid('Docente requerido'),
  periodo_academico_id: z.string().uuid('Período académico requerido'),
  dia_semana: z.nativeEnum(DiaSemana),
  hora_inicio: timeSchema,
  hora_fin: timeSchema,
  jornada: z.nativeEnum(Jornada).default(Jornada.matutina),
  modalidad: z.nativeEnum(Modalidad).default(Modalidad.presencial),
  ubicacion: z.string().trim().max(120).optional(),
  descripcion: z.string().trim().max(500).optional(),
  activo: z.boolean().default(true),
});

export const createHorarioAdministrativoSchema = horarioAdministrativoBaseSchema.refine(
  (data) => data.hora_inicio < data.hora_fin,
  { message: 'La hora de inicio debe ser anterior a la hora de fin.', path: ['hora_fin'] }
);

export const updateHorarioAdministrativoSchema = horarioAdministrativoBaseSchema.partial().refine(
  (data) => !data.hora_inicio || !data.hora_fin || data.hora_inicio < data.hora_fin,
  { message: 'La hora de inicio debe ser anterior a la hora de fin.', path: ['hora_fin'] }
);

export { locationSchema };
export type HorarioAdministrativoInput = z.infer<typeof createHorarioAdministrativoSchema>;
export type HorarioAdministrativoUpdateInput = z.infer<typeof updateHorarioAdministrativoSchema>;
export type HorarioAdministrativoQueryInput = z.infer<typeof horarioAdministrativoQuerySchema>;
export type AdministrativeLocationInput = z.infer<typeof locationSchema>;
