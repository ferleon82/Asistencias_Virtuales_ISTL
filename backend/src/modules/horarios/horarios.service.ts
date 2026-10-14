import { Prisma, Rol } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import type { CreateHorarioInput, HorarioQueryInput, JornadaInput, UpdateHorarioInput } from './horarios.schemas';

interface AuthScope {
  id: string;
  rol: string;
}

const horarioInclude = {
  periodo_academico: true,
  asignacion_docente: {
    include: {
      docente: { select: { id: true, nombre: true, apellido: true, email: true } },
      periodo_academico: true,
      materia: { select: { id: true, nombre: true, codigo: true, ciclo: true } },
    },
  },
  docente: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
    },
  },
  materia: {
    select: {
      id: true,
      nombre: true,
      codigo: true,
      ciclo: true,
      docente_id: true,
      docente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
        },
      },
      carrera: {
        select: {
          id: true,
          nombre: true,
          codigo: true,
          coordinador_id: true,
        },
      },
    },
  },
} satisfies Prisma.HorarioInclude;

function buildRoleWhere(user: AuthScope): Prisma.HorarioWhereInput {
  if (user.rol === Rol.docente) {
    return { docente_id: user.id };
  }

  if (user.rol === Rol.coordinador) {
    return { materia: { carrera: { coordinador_id: user.id } } };
  }

  return {};
}

function buildFilterWhere(filters: HorarioQueryInput): Prisma.HorarioWhereInput {
  return {
    materia_id: filters.materia_id,
    periodo_academico_id: filters.periodo_academico_id,
    dia_semana: filters.dia_semana,
    ciclo: filters.ciclo,
    jornada: filters.jornada,
    modalidad: filters.modalidad,
    activo: filters.activo,
    docente_id: filters.docente_id,
    materia: {
      carrera_id: filters.carrera_id,
    },
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

const DIA_LABEL: Record<string, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
};

function normalizeParalelo(paralelo?: string): 'A' | 'B' | 'C' | 'D' {
  return paralelo === 'B' || paralelo === 'C' || paralelo === 'D' ? paralelo : 'A';
}

export class HorariosService {
  async list(filters: HorarioQueryInput, user: AuthScope) {
    const where: Prisma.HorarioWhereInput = {
      AND: [buildRoleWhere(user), buildFilterWhere(filters)],
    };

    return prisma.horario.findMany({
      where,
      include: horarioInclude,
      orderBy: [{ ciclo: 'desc' }, { dia_semana: 'asc' }, { hora_inicio: 'asc' }],
    });
  }

  async getById(id: string, user: AuthScope) {
    const horario = await prisma.horario.findFirst({
      where: {
        id,
        AND: [buildRoleWhere(user)],
      },
      include: horarioInclude,
    });

    if (!horario) {
      throw new AppError('Horario no encontrado.', 404);
    }

    return horario;
  }

  async create(data: CreateHorarioInput, user: AuthScope, ip: string) {
    await this.assertMateriaManageable(data.materia_id, user);
    await this.assertDocenteManageable(data.docente_id, user);
    const normalizedData = await this.normalizePeriodo(data);
    const asignacion = await this.resolveAssignment(normalizedData);
    await this.assertNoOverlap(normalizedData);
    const { paralelo: _paralelo, ...horarioData } = normalizedData;

    const horario = await prisma.horario.create({
      data: {
        ...horarioData,
        asignacion_docente_id: asignacion.id,
      },
      include: horarioInclude,
    });

    await this.audit(user.id, 'CREATE_HORARIO', horario.id, ip, null, normalizedData);

    return horario;
  }

  async update(id: string, data: UpdateHorarioInput, user: AuthScope, ip: string) {
    const current = await this.getManageableHorario(id, user);
    const nextMateriaId = data.materia_id ?? current.materia_id;
    const nextDocenteId = data.docente_id ?? current.docente_id;
    const nextPeriodoId = data.periodo_academico_id ?? current.periodo_academico_id;

    if (data.materia_id) {
      await this.assertMateriaManageable(data.materia_id, user);
    }

    if (!nextDocenteId) {
      throw new AppError('Docente requerido para el horario.', 400);
    }
    if (!nextPeriodoId) {
      throw new AppError('Período académico requerido para la asignación docente.', 400);
    }

    if (data.docente_id) {
      await this.assertDocenteManageable(data.docente_id, user);
    }

    const normalizedData = await this.normalizePeriodo<CreateHorarioInput>({
      materia_id: nextMateriaId,
      docente_id: nextDocenteId,
      periodo_academico_id: nextPeriodoId,
      dia_semana: data.dia_semana ?? current.dia_semana,
      hora_inicio: data.hora_inicio ?? current.hora_inicio,
      hora_fin: data.hora_fin ?? current.hora_fin,
      ciclo: data.ciclo ?? current.ciclo,
      jornada: data.jornada ?? current.jornada,
      paralelo: normalizeParalelo(data.paralelo ?? current.asignacion_docente?.paralelo),
      modalidad: data.modalidad ?? current.modalidad,
      url_aula_virtual: data.url_aula_virtual ?? current.url_aula_virtual ?? undefined,
      activo: data.activo ?? current.activo,
      fecha_inicio_ciclo: data.fecha_inicio_ciclo ?? current.fecha_inicio_ciclo,
      fecha_fin_ciclo: data.fecha_fin_ciclo ?? current.fecha_fin_ciclo,
    });
    const asignacion = await this.resolveAssignment(normalizedData);
    await this.assertNoOverlap(normalizedData, id);
    const { paralelo: _paralelo, ...horarioData } = normalizedData;

    const horario = await prisma.horario.update({
      where: { id },
      data: {
        ...horarioData,
        asignacion_docente_id: asignacion.id,
      },
      include: horarioInclude,
    });

    await this.audit(user.id, 'UPDATE_HORARIO', id, ip, current, data);

    return horario;
  }

  // ─── Jornada semanal ──────────────────────────────────────────────────────────
  //
  // Una jornada es la asignación docente (materia + docente + período + jornada +
  // paralelo) con todos sus bloques semanales. Se guarda completa o no se guarda.

  /** Crea todos los bloques semanales de una materia para un docente. */
  async createJornada(data: JornadaInput, user: AuthScope, ip: string) {
    await this.assertJornadaManageable(data, user);

    const existente = await prisma.asignacionDocente.findUnique({
      where: { asignacion_docente_unica: this.asignacionKey(data) },
      select: { id: true, horarios: { where: { activo: true }, select: { id: true } } },
    });
    if (existente && existente.horarios.length > 0) {
      throw new AppError('Esta materia ya tiene una jornada para el docente, jornada y paralelo. Use "Editar jornada".', 409);
    }

    // Un horario antiguo sin asignación docente se "adopta": pasa a la jornada
    // conservando su id (y sus asistencias) en lugar de duplicarse.
    const adoptadosIds = await this.assertAdoptables(
      data.bloques.flatMap((bloque) => (bloque.id ? [bloque.id] : [])),
      user,
      'Una jornada nueva solo puede incluir horarios antiguos sin jornada asignada.'
    );

    return this.saveJornada(data, adoptadosIds, user, ip, 'CREATE_JORNADA');
  }

  /**
   * Reemplaza los bloques de una jornada: actualiza los que vienen con id, crea
   * los nuevos y desactiva los que se quitaron (nunca se borran: pueden tener
   * asistencias). Si cambian materia, docente o paralelo, se aplica a todos.
   */
  async updateJornada(asignacionId: string, data: JornadaInput, user: AuthScope, ip: string) {
    const actuales = await this.getJornadaHorarios(asignacionId, user);
    await this.assertJornadaManageable(data, user);

    // Además de sus propios bloques, una jornada puede incorporar horarios antiguos sin asignación.
    const actualesIds = new Set(actuales.map((horario) => horario.id));
    const externosIds = data.bloques.flatMap((bloque) => (bloque.id && !actualesIds.has(bloque.id) ? [bloque.id] : []));
    const adoptadosIds = await this.assertAdoptables(externosIds, user, 'Uno de los bloques no pertenece a esta jornada.');

    return this.saveJornada(data, [...actualesIds, ...adoptadosIds], user, ip, 'UPDATE_JORNADA', asignacionId);
  }

  /** Desactiva todos los bloques de una jornada. */
  async deactivateJornada(asignacionId: string, user: AuthScope, ip: string) {
    const actuales = await this.getJornadaHorarios(asignacionId, user);

    await prisma.$transaction([
      prisma.horario.updateMany({ where: { id: { in: actuales.map((horario) => horario.id) } }, data: { activo: false } }),
      prisma.asignacionDocente.update({ where: { id: asignacionId }, data: { activa: false } }),
    ]);
    await this.audit(user.id, 'DEACTIVATE_JORNADA', asignacionId, ip, actuales, { activo: false });

    return { asignacion_docente_id: asignacionId, horarios_desactivados: actuales.length };
  }

  /** Verifica que los ids sean horarios antiguos, activos, sin asignación y gestionables por el usuario. */
  private async assertAdoptables(ids: string[], user: AuthScope, mensaje: string): Promise<string[]> {
    if (!ids.length) return [];
    const adoptables = await prisma.horario.findMany({
      where: { id: { in: ids }, activo: true, asignacion_docente_id: null, AND: [buildRoleWhere(user)] },
      select: { id: true },
    });
    if (adoptables.length !== ids.length) {
      throw new AppError(mensaje, 400);
    }
    return ids;
  }

  private asignacionKey(data: Pick<JornadaInput, 'materia_id' | 'docente_id' | 'periodo_academico_id' | 'jornada' | 'paralelo'>) {
    return {
      materia_id: data.materia_id,
      docente_id: data.docente_id,
      periodo_academico_id: data.periodo_academico_id,
      jornada: data.jornada,
      paralelo: data.paralelo,
    };
  }

  private async assertJornadaManageable(data: JornadaInput, user: AuthScope): Promise<void> {
    await this.assertMateriaManageable(data.materia_id, user);
    await this.assertDocenteManageable(data.docente_id, user);
  }

  /** Bloques activos de una jornada que el usuario puede gestionar. */
  private async getJornadaHorarios(asignacionId: string, user: AuthScope) {
    const asignacion = await prisma.asignacionDocente.findUnique({
      where: { id: asignacionId },
      select: { materia_id: true },
    });
    if (!asignacion) {
      throw new AppError('Jornada no encontrada.', 404);
    }
    await this.assertMateriaManageable(asignacion.materia_id, user);

    const horarios = await prisma.horario.findMany({
      where: { asignacion_docente_id: asignacionId, activo: true, AND: [buildRoleWhere(user)] },
    });
    if (horarios.length === 0) {
      throw new AppError('La jornada no tiene bloques activos.', 404);
    }
    return horarios;
  }

  /**
   * Verifica que ningún bloque se cruce con otra clase o con una hora
   * administrativa del docente en el período, e indica cuál es el conflicto.
   */
  private async assertJornadaSinCruces(data: JornadaInput, excludeIds: string[]): Promise<void> {
    const [clases, administrativos] = await Promise.all([
      prisma.horario.findMany({
        where: {
          id: excludeIds.length ? { notIn: excludeIds } : undefined,
          docente_id: data.docente_id,
          periodo_academico_id: data.periodo_academico_id,
          activo: true,
        },
        select: { dia_semana: true, hora_inicio: true, hora_fin: true, materia: { select: { nombre: true } } },
      }),
      prisma.horarioAdministrativo.findMany({
        where: { docente_id: data.docente_id, periodo_academico_id: data.periodo_academico_id, activo: true },
        select: { dia_semana: true, hora_inicio: true, hora_fin: true },
      }),
    ]);

    for (const bloque of data.bloques) {
      const bloqueLabel = `${DIA_LABEL[bloque.dia_semana]} ${bloque.hora_inicio}-${bloque.hora_fin}`;
      const clase = clases.find(
        (item) => item.dia_semana === bloque.dia_semana && overlaps(bloque.hora_inicio, bloque.hora_fin, item.hora_inicio, item.hora_fin)
      );
      if (clase) {
        throw new AppError(
          `El bloque del ${bloqueLabel} se cruza con ${clase.materia.nombre} (${clase.hora_inicio}-${clase.hora_fin}) del mismo docente.`,
          409
        );
      }
      const administrativo = administrativos.find(
        (item) => item.dia_semana === bloque.dia_semana && overlaps(bloque.hora_inicio, bloque.hora_fin, item.hora_inicio, item.hora_fin)
      );
      if (administrativo) {
        throw new AppError(
          `El bloque del ${bloqueLabel} se cruza con una hora administrativa del docente (${administrativo.hora_inicio}-${administrativo.hora_fin}).`,
          409
        );
      }
    }
  }

  private async saveJornada(
    data: JornadaInput,
    actualesIds: string[],
    user: AuthScope,
    ip: string,
    accion: 'CREATE_JORNADA' | 'UPDATE_JORNADA',
    asignacionAnteriorId?: string
  ) {
    const periodo = await prisma.periodoAcademico.findUnique({ where: { id: data.periodo_academico_id } });
    if (!periodo || !periodo.activo) {
      throw new AppError('Período académico no encontrado o inactivo.', 404);
    }
    await this.assertJornadaSinCruces(data, actualesIds);

    const asignacionId = await prisma.$transaction(async (tx) => {
      const asignacion = await tx.asignacionDocente.upsert({
        where: { asignacion_docente_unica: this.asignacionKey(data) },
        create: this.asignacionKey(data),
        update: { activa: true },
      });

      // Datos comunes a todos los bloques; las fechas y el ciclo salen del período.
      const comunes = {
        materia_id: data.materia_id,
        docente_id: data.docente_id,
        periodo_academico_id: periodo.id,
        asignacion_docente_id: asignacion.id,
        ciclo: periodo.codigo,
        jornada: data.jornada,
        modalidad: data.modalidad,
        url_aula_virtual: data.url_aula_virtual ?? null,
        fecha_inicio_ciclo: periodo.fecha_inicio,
        fecha_fin_ciclo: periodo.fecha_fin,
        activo: true,
      };

      for (const bloque of data.bloques) {
        const horario = { ...comunes, dia_semana: bloque.dia_semana, hora_inicio: bloque.hora_inicio, hora_fin: bloque.hora_fin };
        if (bloque.id) {
          await tx.horario.update({ where: { id: bloque.id }, data: horario });
        } else {
          await tx.horario.create({ data: horario });
        }
      }

      const conservados = new Set(data.bloques.flatMap((bloque) => (bloque.id ? [bloque.id] : [])));
      const quitados = actualesIds.filter((id) => !conservados.has(id));
      if (quitados.length) {
        await tx.horario.updateMany({ where: { id: { in: quitados } }, data: { activo: false } });
      }

      // Si cambió materia, docente, jornada o paralelo, la asignación anterior queda sin bloques.
      if (asignacionAnteriorId && asignacionAnteriorId !== asignacion.id) {
        const restantes = await tx.horario.count({ where: { asignacion_docente_id: asignacionAnteriorId, activo: true } });
        if (restantes === 0) {
          await tx.asignacionDocente.update({ where: { id: asignacionAnteriorId }, data: { activa: false } });
        }
      }

      await tx.auditLog.create({
        data: {
          user_id: user.id,
          accion,
          tabla_afectada: 'horarios',
          registro_id: asignacion.id,
          ip,
          datos_anteriores: (asignacionAnteriorId ? { asignacion_docente_id: asignacionAnteriorId, horarios: actualesIds } : undefined) as
            | Prisma.InputJsonValue
            | undefined,
          datos_nuevos: data as unknown as Prisma.InputJsonValue,
        },
      });

      return asignacion.id;
    });

    return prisma.horario.findMany({
      where: { asignacion_docente_id: asignacionId, activo: true },
      include: horarioInclude,
      orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }],
    });
  }

  async deactivate(id: string, user: AuthScope, ip: string) {
    const current = await this.getManageableHorario(id, user);

    const horario = await prisma.horario.update({
      where: { id },
      data: { activo: false },
      include: horarioInclude,
    });

    await this.audit(user.id, 'DEACTIVATE_HORARIO', id, ip, current, { activo: false });

    return horario;
  }

  private async getManageableHorario(id: string, user: AuthScope) {
    const horario = await prisma.horario.findFirst({
      where: {
        id,
        AND: [buildRoleWhere(user)],
      },
      include: { asignacion_docente: { select: { paralelo: true } } },
    });

    if (!horario) {
      throw new AppError('Horario no encontrado o sin permisos de gestion.', 404);
    }

    return horario;
  }

  private async assertMateriaManageable(materiaId: string, user: AuthScope): Promise<void> {
    const materia = await prisma.materia.findUnique({
      where: { id: materiaId },
      select: {
        docente_id: true,
        carrera: {
          select: {
            coordinador_id: true,
          },
        },
      },
    });

    if (!materia) {
      throw new AppError('Materia no encontrada.', 404);
    }

    if (user.rol === Rol.coordinador && materia.carrera.coordinador_id !== user.id) {
      throw new AppError('No puede gestionar horarios de una carrera no coordinada.', 403);
    }
  }
  private async assertDocenteManageable(docenteId: string, user: AuthScope): Promise<void> {
    const docente = await prisma.user.findUnique({
      where: { id: docenteId },
      select: { id: true, rol: true, activo: true },
    });

    if (!docente || !docente.activo || docente.rol !== Rol.docente) {
      throw new AppError('Docente no encontrado o inactivo.', 404);
    }

    if (user.rol === Rol.docente && docente.id !== user.id) {
      throw new AppError('No puede gestionar horarios de otro docente.', 403);
    }
  }
  private async resolveAssignment(data: CreateHorarioInput) {
    return prisma.asignacionDocente.upsert({
      where: {
        asignacion_docente_unica: {
          materia_id: data.materia_id,
          docente_id: data.docente_id,
          periodo_academico_id: data.periodo_academico_id,
          jornada: data.jornada,
          paralelo: data.paralelo,
        },
      },
      create: {
        materia_id: data.materia_id,
        docente_id: data.docente_id,
        periodo_academico_id: data.periodo_academico_id,
        jornada: data.jornada,
        paralelo: data.paralelo,
      },
      update: { activa: true },
    });
  }

  private async assertNoOverlap(data: CreateHorarioInput, excludeId?: string): Promise<void> {
    if (!data.activo) return;

    const [academicos, administrativos] = await Promise.all([
      prisma.horario.findMany({
        where: {
          id: excludeId ? { not: excludeId } : undefined,
          docente_id: data.docente_id,
          periodo_academico_id: data.periodo_academico_id ?? undefined,
          dia_semana: data.dia_semana,
          ciclo: data.periodo_academico_id ? undefined : data.ciclo,
          activo: true,
        },
        select: { hora_inicio: true, hora_fin: true },
      }),
      prisma.horarioAdministrativo.findMany({
        where: {
          docente_id: data.docente_id,
          periodo_academico_id: data.periodo_academico_id,
          dia_semana: data.dia_semana,
          activo: true,
        },
        select: { hora_inicio: true, hora_fin: true },
      }),
    ]);

    if (academicos.some((item) => overlaps(data.hora_inicio, data.hora_fin, item.hora_inicio, item.hora_fin))) {
      throw new AppError('Ya existe un horario activo que se cruza para este docente, día y ciclo.', 409);
    }

    if (administrativos.some((item) => overlaps(data.hora_inicio, data.hora_fin, item.hora_inicio, item.hora_fin))) {
      throw new AppError('El horario se cruza con una hora administrativa activa del docente.', 409);
    }
  }

  private async normalizePeriodo<T extends Partial<CreateHorarioInput>>(
    data: T,
    current?: { periodo_academico_id: string | null; ciclo: string; fecha_inicio_ciclo: Date; fecha_fin_ciclo: Date }
  ): Promise<T> {
    const periodoId = data.periodo_academico_id ?? current?.periodo_academico_id;
    if (!periodoId) {
      throw new AppError('Período académico requerido para crear la asignación docente.', 400);
    }

    const periodo = await prisma.periodoAcademico.findUnique({
      where: { id: periodoId },
    });

    if (!periodo || !periodo.activo) {
      throw new AppError('Período académico no encontrado o inactivo.', 404);
    }

    return {
      ...data,
      periodo_academico_id: periodo.id,
      ciclo: periodo.codigo,
      fecha_inicio_ciclo: periodo.fecha_inicio,
      fecha_fin_ciclo: periodo.fecha_fin,
    };
  }

  private async audit(
    userId: string,
    accion: string,
    registroId: string,
    ip: string,
    previous: unknown,
    next: unknown
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        accion,
        tabla_afectada: 'horarios',
        registro_id: registroId,
        ip,
        datos_anteriores: previous as Prisma.InputJsonValue,
        datos_nuevos: next as Prisma.InputJsonValue,
      },
    });
  }
}

export const horariosService = new HorariosService();
