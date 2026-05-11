import { DiaSemana, Modalidad } from '@prisma/client';
import { z } from 'zod';

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:mm');

const dateSchema = z.coerce.date();

export const horarioParamsSchema = z.object({
  id: z.string().uuid('ID de horario invalido'),
});

export const horarioQuerySchema = z.object({
  materia_id: z.string().uuid().optional(),
  docente_id: z.string().uuid().optional(),
  carrera_id: z.string().uuid().optional(),
  dia_semana: z.nativeEnum(DiaSemana).optional(),
  ciclo: z.string().trim().min(1).optional(),
  modalidad: z.nativeEnum(Modalidad).optional(),
  activo: z.coerce.boolean().optional(),
});

const horarioBaseSchema = z.object({
  materia_id: z.string().uuid('Materia requerida'),
  dia_semana: z.nativeEnum(DiaSemana),
  hora_inicio: timeSchema,
  hora_fin: timeSchema,
  ciclo: z.string().trim().min(1, 'Ciclo requerido').max(30),
  modalidad: z.nativeEnum(Modalidad).default(Modalidad.virtual),
  url_aula_virtual: z.string().url('URL de aula virtual invalida').optional(),
  activo: z.boolean().default(true),
  fecha_inicio_ciclo: dateSchema,
  fecha_fin_ciclo: dateSchema,
});

export const createHorarioSchema = horarioBaseSchema
  .refine((data) => data.hora_inicio < data.hora_fin, {
    message: 'La hora de inicio debe ser anterior a la hora de fin',
    path: ['hora_fin'],
  })
  .refine((data) => data.fecha_inicio_ciclo <= data.fecha_fin_ciclo, {
    message: 'La fecha de inicio del ciclo debe ser anterior o igual a la fecha fin',
    path: ['fecha_fin_ciclo'],
  });

export const updateHorarioSchema = horarioBaseSchema
  .partial()
  .refine((data) => !data.hora_inicio || !data.hora_fin || data.hora_inicio < data.hora_fin, {
    message: 'La hora de inicio debe ser anterior a la hora de fin',
    path: ['hora_fin'],
  })
  .refine(
    (data) =>
      !data.fecha_inicio_ciclo ||
      !data.fecha_fin_ciclo ||
      data.fecha_inicio_ciclo <= data.fecha_fin_ciclo,
    {
      message: 'La fecha de inicio del ciclo debe ser anterior o igual a la fecha fin',
      path: ['fecha_fin_ciclo'],
    }
  );

export type HorarioQueryInput = z.infer<typeof horarioQuerySchema>;
export type CreateHorarioInput = z.infer<typeof createHorarioSchema>;
export type UpdateHorarioInput = z.infer<typeof updateHorarioSchema>;
