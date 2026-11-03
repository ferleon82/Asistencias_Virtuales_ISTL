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
  /** Solo los bloques que el docente debe cumplir hoy (vigencia y jornada temporal). */
  hoy: z.coerce.boolean().optional(),
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

// ─── Jornada administrativa semanal ──────────────────────────────────────────

const DIA_ORDEN: Record<DiaSemana, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD');

const bloqueAdministrativoSchema = z
  .object({
    dia_semana: z.nativeEnum(DiaSemana),
    hora_inicio: timeSchema,
    hora_fin: timeSchema,
  })
  .refine((bloque) => bloque.hora_inicio < bloque.hora_fin, {
    message: 'La hora de inicio de cada bloque debe ser anterior a la hora de fin.',
    path: ['hora_fin'],
  });

/**
 * Todos los bloques semanales de un docente con datos comunes. Sin fechas, la
 * jornada vale todo el período; con fechas es temporal y, en ese rango,
 * reemplaza a la jornada regular del docente.
 */
export const jornadaAdministrativaSchema = z
  .object({
    docente_id: z.string().uuid('Docente requerido'),
    periodo_academico_id: z.string().uuid('Período académico requerido'),
    modalidad: z.nativeEnum(Modalidad).default(Modalidad.presencial),
    ubicacion: z.string().trim().max(120).optional(),
    descripcion: z.string().trim().max(500).optional(),
    fecha_inicio: dateSchema.optional(),
    fecha_fin: dateSchema.optional(),
    bloques: z.array(bloqueAdministrativoSchema).min(1, 'Agregue al menos un bloque a la jornada.').max(40),
  })
  .superRefine((data, ctx) => {
    if (!!data.fecha_inicio !== !!data.fecha_fin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fecha_fin'], message: 'Indique la fecha inicial y la final de la jornada temporal.' });
      return;
    }
    if (data.fecha_inicio && data.fecha_fin && data.fecha_fin < data.fecha_inicio) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fecha_fin'], message: 'La fecha final debe ser igual o posterior a la inicial.' });
      return;
    }
    const ordenados = [...data.bloques].sort(
      (a, b) => DIA_ORDEN[a.dia_semana] - DIA_ORDEN[b.dia_semana] || a.hora_inicio.localeCompare(b.hora_inicio)
    );
    for (let i = 1; i < ordenados.length; i += 1) {
      const anterior = ordenados[i - 1];
      const actual = ordenados[i];
      if (anterior.dia_semana === actual.dia_semana && actual.hora_inicio < anterior.hora_fin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bloques'],
          message: `Los bloques del ${actual.dia_semana} ${anterior.hora_inicio}-${anterior.hora_fin} y ${actual.hora_inicio}-${actual.hora_fin} se cruzan.`,
        });
        return;
      }
    }
  });

export const grupoParamsSchema = z.object({
  grupoId: z.string().uuid('ID de jornada inválido'),
});

export { locationSchema };
export type HorarioAdministrativoInput = z.infer<typeof createHorarioAdministrativoSchema>;
export type HorarioAdministrativoUpdateInput = z.infer<typeof updateHorarioAdministrativoSchema>;
export type JornadaAdministrativaInput = z.infer<typeof jornadaAdministrativaSchema>;
export type HorarioAdministrativoQueryInput = z.infer<typeof horarioAdministrativoQuerySchema>;
export type AdministrativeLocationInput = z.infer<typeof locationSchema>;
