import { DiaSemana, EstadoAsistencia, Prisma, Rol } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { calcularEstadoAsistencia, nowInEcuador } from '../../shared/utils/timezone';
import type { JustificarAsistenciaInput, ListAsistenciasQueryInput, LocationInput } from './asistencias.schemas';

interface AuthScope {
  id: string;
  rol: string;
}

const asistenciaInclude = {
  docente: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
    },
  },
  horario: {
    include: {
      materia: {
        select: {
          id: true,
          nombre: true,
          codigo: true,
          docente_id: true,
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
    },
  },
} satisfies Prisma.RegistroAsistenciaInclude;

function getDiaSemana(date: Date): DiaSemana {
  const day = date.getDay();
  const map: Record<number, DiaSemana> = {
    1: DiaSemana.lunes,
    2: DiaSemana.martes,
    3: DiaSemana.miercoles,
    4: DiaSemana.jueves,
    5: DiaSemana.viernes,
    6: DiaSemana.sabado,
  };

  const dia = map[day];
  if (!dia) {
    throw new AppError('No existen horarios academicos configurados para domingo.', 404);
  }

  return dia;
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function buildRoleWhere(user: AuthScope): Prisma.RegistroAsistenciaWhereInput {
  if (user.rol === Rol.docente) {
    return { docente_id: user.id };
  }

  if (user.rol === Rol.coordinador) {
    return { horario: { materia: { carrera: { coordinador_id: user.id } } } };
  }

  return {};
}

function buildFiltersWhere(filters: ListAsistenciasQueryInput): Prisma.RegistroAsistenciaWhereInput {
  return {
    docente_id: filters.docente_id,
    horario_id: filters.horario_id,
    estado: filters.estado,
    timestamp_entrada:
      filters.fecha_inicio || filters.fecha_fin
        ? {
            gte: filters.fecha_inicio,
            lte: filters.fecha_fin,
          }
        : undefined,
  };
}

export class AsistenciasService {
  async getEstadoActual(user: AuthScope) {
    if (user.rol !== Rol.docente) {
      throw new AppError('El estado actual de clase aplica solo para docentes.', 403);
    }

    const now = nowInEcuador();
    const horario = await this.findHorarioActivo(user.id, now);
    const registroAbierto = await this.findRegistroAbierto(user.id);
    const registroDelHorario = horario ? await this.findRegistroDelHorarioHoy(user.id, horario.id, now) : null;

    return {
      horarioActivo: horario,
      registroAbierto,
      puedeMarcarEntrada: !!horario && !registroAbierto && !registroDelHorario,
      puedeMarcarSalida: !!registroAbierto,
    };
  }

  async marcarEntrada(user: AuthScope, location: LocationInput, ip: string, userAgent?: string) {
    if (user.rol !== Rol.docente) {
      throw new AppError('Solo los docentes pueden marcar asistencia.', 403);
    }

    const open = await this.findRegistroAbierto(user.id);
    if (open) {
      throw new AppError('Ya existe una asistencia abierta. Marque salida antes de registrar otro ingreso.', 409);
    }

    const now = nowInEcuador();
    const horario = await this.findHorarioActivo(user.id, now);
    if (!horario) {
      throw new AppError('No hay una clase activa dentro de la ventana de marcado.', 404);
    }

    const alreadyMarked = await this.findRegistroDelHorarioHoy(user.id, horario.id, now);
    if (alreadyMarked) {
      throw new AppError('La asistencia de esta clase ya fue registrada. No puede marcar ingreso nuevamente.', 409);
    }

    const estadoCalculado = calcularEstadoAsistencia(now, horario.hora_inicio, now);
    if (estadoCalculado === 'fuera_de_ventana') {
      throw new AppError('La clase no esta dentro de la ventana permitida de marcado.', 400);
    }

    const registro = await prisma.registroAsistencia.create({
      data: {
        docente_id: user.id,
        horario_id: horario.id,
        timestamp_entrada: now,
        ip_entrada: ip,
        lat: location.lat,
        lng: location.lng,
        precision_m: location.precision_m,
        estado: estadoCalculado,
        user_agent: userAgent,
      },
      include: asistenciaInclude,
    });

    await this.audit(user.id, 'MARCAR_ENTRADA', registro.id, ip, {
      horario_id: horario.id,
      estado: estadoCalculado,
    });

    return registro;
  }

  async marcarSalida(user: AuthScope, location: LocationInput, ip: string) {
    if (user.rol !== Rol.docente) {
      throw new AppError('Solo los docentes pueden marcar salida.', 403);
    }

    const open = await this.findRegistroAbierto(user.id);
    if (!open) {
      throw new AppError('No tiene una asistencia abierta para marcar salida.', 404);
    }

    const registro = await prisma.registroAsistencia.update({
      where: { id: open.id },
      data: {
        timestamp_salida: nowInEcuador(),
        ip_salida: ip,
        lat: location.lat ?? open.lat,
        lng: location.lng ?? open.lng,
        precision_m: location.precision_m ?? open.precision_m,
      },
      include: asistenciaInclude,
    });

    await this.audit(user.id, 'MARCAR_SALIDA', registro.id, ip, {
      horario_id: registro.horario_id,
    });

    return registro;
  }

  async list(filters: ListAsistenciasQueryInput, user: AuthScope) {
    return prisma.registroAsistencia.findMany({
      where: {
        AND: [buildRoleWhere(user), buildFiltersWhere(filters)],
      },
      include: asistenciaInclude,
      orderBy: [{ timestamp_entrada: 'desc' }, { created_at: 'desc' }],
      take: 100,
    });
  }

  async solicitarJustificacion(id: string, data: JustificarAsistenciaInput, user: AuthScope, ip: string) {
    if (user.rol !== Rol.docente) {
      throw new AppError('Solo los docentes pueden solicitar justificaciones.', 403);
    }

    const current = await prisma.registroAsistencia.findFirst({
      where: {
        id,
        docente_id: user.id,
      },
      include: asistenciaInclude,
    });

    if (!current) {
      throw new AppError('Registro de asistencia no encontrado.', 404);
    }

    if (current.estado === EstadoAsistencia.justificado) {
      throw new AppError('Este registro ya fue justificado.', 409);
    }

    const registro = await prisma.registroAsistencia.update({
      where: { id },
      data: { justificacion: data.justificacion },
      include: asistenciaInclude,
    });

    await this.audit(user.id, 'SOLICITAR_JUSTIFICACION', id, ip, data);
    return registro;
  }

  async aprobarJustificacion(id: string, user: AuthScope, ip: string) {
    const current = await this.getManageableRegistro(id, user);

    if (!current.justificacion) {
      throw new AppError('El registro no tiene justificacion solicitada.', 400);
    }

    const registro = await prisma.registroAsistencia.update({
      where: { id },
      data: { estado: EstadoAsistencia.justificado },
      include: asistenciaInclude,
    });

    await this.audit(user.id, 'APROBAR_JUSTIFICACION', id, ip, { estado: EstadoAsistencia.justificado });
    return registro;
  }

  async rechazarJustificacion(id: string, user: AuthScope, ip: string) {
    await this.getManageableRegistro(id, user);

    const registro = await prisma.registroAsistencia.update({
      where: { id },
      data: { justificacion: null },
      include: asistenciaInclude,
    });

    await this.audit(user.id, 'RECHAZAR_JUSTIFICACION', id, ip, { justificacion: null });
    return registro;
  }

  private async getManageableRegistro(id: string, user: AuthScope) {
    const registro = await prisma.registroAsistencia.findFirst({
      where: {
        id,
        AND: [buildRoleWhere(user)],
      },
      include: asistenciaInclude,
    });

    if (!registro) {
      throw new AppError('Registro de asistencia no encontrado o sin permisos.', 404);
    }

    return registro;
  }

  private async findHorarioActivo(docenteId: string, now: Date) {
    const diaSemana = getDiaSemana(now);

    const candidates = await prisma.horario.findMany({
      where: {
        dia_semana: diaSemana,
        activo: true,
        fecha_inicio_ciclo: { lte: now },
        fecha_fin_ciclo: { gte: now },
        materia: {
          docente_id: docenteId,
          activa: true,
        },
      },
      include: {
        materia: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
          },
        },
      },
      orderBy: { hora_inicio: 'asc' },
    });

    return (
      candidates.find((horario) => calcularEstadoAsistencia(now, horario.hora_inicio, now) !== 'fuera_de_ventana') ??
      null
    );
  }

  private async findRegistroAbierto(docenteId: string) {
    const today = nowInEcuador();

    return prisma.registroAsistencia.findFirst({
      where: {
        docente_id: docenteId,
        timestamp_salida: null,
        timestamp_entrada: {
          gte: startOfDay(today),
          lte: endOfDay(today),
        },
      },
      include: asistenciaInclude,
      orderBy: { timestamp_entrada: 'desc' },
    });
  }

  private async findRegistroDelHorarioHoy(docenteId: string, horarioId: string, date: Date) {
    return prisma.registroAsistencia.findFirst({
      where: {
        docente_id: docenteId,
        horario_id: horarioId,
        timestamp_entrada: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
      },
      include: asistenciaInclude,
      orderBy: { timestamp_entrada: 'desc' },
    });
  }

  private async audit(userId: string, accion: string, registroId: string, ip: string, payload: unknown): Promise<void> {
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        accion,
        tabla_afectada: 'registros_asistencia',
        registro_id: registroId,
        ip,
        datos_nuevos: payload as Prisma.InputJsonValue,
      },
    });
  }
}

export const asistenciasService = new AsistenciasService();
