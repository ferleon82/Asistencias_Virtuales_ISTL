import { DiaSemana, Jornada, Modalidad } from '@prisma/client';
import { z } from 'zod';

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:mm');

const dateSchema = z.coerce.date();

export const horarioParamsSchema = z.object({
  id: z.string().uuid('ID de horario inválido'),
});

export const horarioQuerySchema = z.object({
  materia_id: z.string().uuid().optional(),
  periodo_academico_id: z.string().uuid().optional(),
  docente_id: z.string().uuid().optional(),
  jornada: z.nativeEnum(Jornada).optional(),
  carrera_id: z.string().uuid().optional(),
  dia_semana: z.nativeEnum(DiaSemana).optional(),
  ciclo: z.string().trim().min(1).optional(),
  modalidad: z.nativeEnum(Modalidad).optional(),
  activo: z.coerce.boolean().optional(),
});

const horarioBaseSchema = z.object({
  materia_id: z.string().uuid('Materia requerida'),
  docente_id: z.string().uuid('Docente requerido'),
  periodo_academico_id: z.string().uuid('Período académico requerido'),
  dia_semana: z.nativeEnum(DiaSemana),
  hora_inicio: timeSchema,
  hora_fin: timeSchema,
  ciclo: z.string().trim().min(1, 'Ciclo requerido').max(30),
  jornada: z.nativeEnum(Jornada).default(Jornada.matutina),
  paralelo: z.enum(['A', 'B', 'C', 'D']).default('A'),
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

// ─── Jornada semanal: todos los bloques de una materia para un docente ────────

const DIA_ORDEN: Record<DiaSemana, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

const bloqueSchema = z
  .object({
    /** Horario existente (al editar). Sin id se crea un bloque nuevo. */
    id: z.string().uuid().optional(),
    dia_semana: z.nativeEnum(DiaSemana),
    hora_inicio: timeSchema,
    hora_fin: timeSchema,
  })
  .refine((bloque) => bloque.hora_inicio < bloque.hora_fin, {
    message: 'La hora de inicio de cada bloque debe ser anterior a la hora de fin',
    path: ['hora_fin'],
  });

export const jornadaSchema = z
  .object({
    materia_id: z.string().uuid('Materia requerida'),
    docente_id: z.string().uuid('Docente requerido'),
    periodo_academico_id: z.string().uuid('Período académico requerido'),
    jornada: z.nativeEnum(Jornada).default(Jornada.matutina),
    paralelo: z.enum(['A', 'B', 'C', 'D']).default('A'),
    modalidad: z.nativeEnum(Modalidad).default(Modalidad.virtual),
    url_aula_virtual: z
      .string()
      .trim()
      .url('URL de aula virtual invalida')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    bloques: z.array(bloqueSchema).min(1, 'Agregue al menos un día a la jornada').max(20),
  })
  .superRefine((data, ctx) => {
    // Se permiten varios bloques el mismo día, siempre que no se crucen entre sí.
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

    const ids = data.bloques.flatMap((bloque) => (bloque.id ? [bloque.id] : []));
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bloques'], message: 'Un bloque está repetido en la jornada.' });
    }
  });

export const asignacionParamsSchema = z.object({
  asignacionId: z.string().uuid('ID de jornada inválido'),
});

export type JornadaInput = z.infer<typeof jornadaSchema>;
