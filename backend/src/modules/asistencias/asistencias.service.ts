import { EstadoAsistencia, Prisma, Rol } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { registrarAuditoria } from '../../shared/attendance/audit';
import { addMinutes, atEcuadorTime, currentTime, ecuadorDayRange, ecuadorDbDate, ecuadorWeekday } from '../../shared/attendance/clock';
import { withDocenteLock, type DbClient } from '../../shared/attendance/lock';
import { marcacionAbiertaQueBloquea } from '../../shared/attendance/openRecords';
import { saveAttendancePhoto } from '../../shared/attendance/photo';
import { getAttendanceSettings, type AttendanceWindows } from '../../shared/attendance/settings';
import { bloqueActivo, estadoEntrada, marcacionAbiertaVigente, permiteEntrada, ventanaSalida } from '../../shared/attendance/windows';
import type { JustificarAsistenciaInput, ListAsistenciasQueryInput, LocationInput } from './asistencias.schemas';

interface AuthScope {
  id: string;
  rol: string;
}

const TABLA_AUDITORIA = 'registros_asistencia';

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
      asignacion_docente: { select: { paralelo: true } },
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

interface RegistroConHorario {
  timestamp_entrada: Date | null;
  timestamp_salida: Date | null;
  justificacion: string | null;
  horario: { hora_inicio: string; hora_fin: string };
}

/**
 * Plazos para justificar una marcación abierta: durante la ventana de entrada
 * (por problemas al marcar) o después de vencida la ventana de salida (salida
 * olvidada). Entre ambos momentos la clase está en curso y debe cerrarse normalmente.
 */
function plazosJustificacion(entrada: Date, horario: RegistroConHorario['horario'], windows: AttendanceWindows) {
  return {
    entradaHasta: addMinutes(atEcuadorTime(entrada, horario.hora_inicio), windows.entryAfterMinutes),
    salidaHasta: ventanaSalida(entrada, horario.hora_fin, windows).hasta,
  };
}

function puedeJustificarse(entrada: Date, horario: RegistroConHorario['horario'], now: Date, windows: AttendanceWindows): boolean {
  const plazos = plazosJustificacion(entrada, horario, windows);
  return now <= plazos.entradaHasta || now > plazos.salidaHasta;
}

function getOpenAttendanceStatus(registro: RegistroConHorario, now: Date, windows: AttendanceWindows) {
  if (!registro.timestamp_entrada || registro.timestamp_salida || registro.justificacion) {
    return { estado_operativo: null, puede_solicitar_justificacion: false };
  }

  return {
    estado_operativo: now <= atEcuadorTime(registro.timestamp_entrada, registro.horario.hora_fin) ? 'en_curso' : 'salida_pendiente',
    puede_solicitar_justificacion: puedeJustificarse(registro.timestamp_entrada, registro.horario, now, windows),
  };
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

    const now = currentTime();
    const { windows, photoRequired } = await getAttendanceSettings();
    const [horario, registroAbierto, bloqueo] = await Promise.all([
      this.findHorarioActivo(user.id, now, windows),
      this.findRegistroAbiertoVigente(user.id, now, windows),
      marcacionAbiertaQueBloquea(user.id, now, windows),
    ]);
    const registroDelHorario = horario
      ? await this.findRegistroDelHorarioHoyIncluyendoJustificacion(user.id, horario.id, now)
      : null;

    const salida = registroAbierto
      ? ventanaSalida(registroAbierto.timestamp_entrada!, registroAbierto.horario.hora_fin, windows)
      : null;
    const puedeMarcarSalida = !!salida && now >= salida.desde && now <= salida.hasta;

    return {
      horarioActivo: horario,
      registroAbierto,
      puedeMarcarEntrada: !!horario && !bloqueo && !registroDelHorario,
      puedeMarcarSalida,
      attendancePhotoRequired: photoRequired,
      salidaDisponibleDesde: salida?.desde.toISOString() ?? null,
      salidaBloqueadaMotivo:
        registroAbierto && !puedeMarcarSalida
          ? `La salida se habilita ${windows.exitBeforeMinutes} minutos antes de la hora de fin de la clase.`
          : null,
    };
  }

  async marcarEntrada(user: AuthScope, location: LocationInput, ip: string, userAgent?: string) {
    if (user.rol !== Rol.docente) {
      throw new AppError('Solo los docentes pueden marcar asistencia.', 403);
    }

    const now = currentTime();
    const { windows, photoRequired } = await getAttendanceSettings();

    return withDocenteLock(user.id, async (tx) => {
      const bloqueo = await marcacionAbiertaQueBloquea(user.id, now, windows, tx);
      if (bloqueo === 'clase') {
        throw new AppError('Ya existe una asistencia abierta. Marque salida antes de registrar otro ingreso.', 409);
      }
      if (bloqueo === 'administrativa') {
        throw new AppError('Debe marcar salida de la hora administrativa antes de iniciar una clase.', 409);
      }

      const horario = await this.findHorarioActivo(user.id, now, windows, tx);
      if (!horario) {
        throw new AppError('No hay una clase activa dentro de la ventana de marcado.', 404);
      }

      const alreadyMarked = await this.findRegistroDelHorarioHoyIncluyendoJustificacion(user.id, horario.id, now, tx);
      if (alreadyMarked) {
        throw new AppError('La asistencia de esta clase ya fue registrada. No puede marcar ingreso nuevamente.', 409);
      }

      const estado = estadoEntrada(now, horario.hora_inicio, windows);
      if (estado === 'fuera_de_ventana') {
        throw new AppError('La clase no esta dentro de la ventana permitida de marcado.', 400);
      }

      const registro = await tx.registroAsistencia.create({
        data: {
          docente_id: user.id,
          horario_id: horario.id,
          timestamp_entrada: now,
          ip_entrada: ip,
          foto_entrada_url: await saveAttendancePhoto(location.foto_base64, user.id, 'entrada', photoRequired),
          lat_entrada: location.lat,
          lng_entrada: location.lng,
          precision_entrada_m: location.precision_m,
          // Campos heredados para que los registros previos sigan siendo compatibles.
          lat: location.lat,
          lng: location.lng,
          precision_m: location.precision_m,
          estado,
          user_agent: userAgent,
        },
        include: asistenciaInclude,
      });

      await registrarAuditoria(
        {
          userId: user.id,
          accion: 'MARCAR_ENTRADA',
          tabla: TABLA_AUDITORIA,
          registroId: registro.id,
          ip,
          datos: { horario_id: horario.id, estado, foto_entrada_url: registro.foto_entrada_url },
        },
        tx
      );

      return registro;
    });
  }

  async marcarSalida(user: AuthScope, location: LocationInput, ip: string) {
    if (user.rol !== Rol.docente) {
      throw new AppError('Solo los docentes pueden marcar salida.', 403);
    }

    const now = currentTime();
    const { windows, photoRequired } = await getAttendanceSettings();

    return withDocenteLock(user.id, async (tx) => {
      const open = await this.findRegistroAbierto(user.id, now, tx);
      if (!open) {
        throw new AppError('No tiene una asistencia abierta para marcar salida.', 404);
      }

      const salida = ventanaSalida(open.timestamp_entrada!, open.horario.hora_fin, windows);
      if (now < salida.desde) {
        throw new AppError(`La salida se habilita ${windows.exitBeforeMinutes} minutos antes de la hora de fin de la clase.`, 400);
      }
      if (now > salida.hasta) {
        throw new AppError('El tiempo para marcar salida terminó. Solicite una justificación.', 400);
      }

      const registro = await tx.registroAsistencia.update({
        where: { id: open.id },
        data: {
          timestamp_salida: now,
          ip_salida: ip,
          foto_salida_url: await saveAttendancePhoto(location.foto_base64, user.id, 'salida', photoRequired),
          lat_salida: location.lat,
          lng_salida: location.lng,
          precision_salida_m: location.precision_m,
          lat: location.lat ?? open.lat,
          lng: location.lng ?? open.lng,
          precision_m: location.precision_m ?? open.precision_m,
        },
        include: asistenciaInclude,
      });

      await registrarAuditoria(
        {
          userId: user.id,
          accion: 'MARCAR_SALIDA',
          tabla: TABLA_AUDITORIA,
          registroId: registro.id,
          ip,
          datos: { horario_id: registro.horario_id, foto_salida_url: registro.foto_salida_url },
        },
        tx
      );

      return registro;
    });
  }

  async list(filters: ListAsistenciasQueryInput, user: AuthScope) {
    const [registros, { windows }] = await Promise.all([
      prisma.registroAsistencia.findMany({
        where: {
          AND: [buildRoleWhere(user), buildFiltersWhere(filters)],
        },
        include: asistenciaInclude,
        orderBy: [{ timestamp_entrada: 'desc' }, { created_at: 'desc' }],
        take: 100,
      }),
      getAttendanceSettings(),
    ]);

    const now = currentTime();
    return registros.map((registro) => ({
      ...registro,
      ...getOpenAttendanceStatus(registro, now, windows),
    }));
  }

  async solicitarJustificacion(id: string, data: JustificarAsistenciaInput, user: AuthScope, ip: string) {
    if (user.rol !== Rol.docente) {
      throw new AppError('Solo los docentes pueden solicitar justificaciones.', 403);
    }

    const current = await prisma.registroAsistencia.findFirst({
      where: { id, docente_id: user.id },
      include: asistenciaInclude,
    });

    if (!current) {
      throw new AppError('Registro de asistencia no encontrado.', 404);
    }

    if (current.estado === EstadoAsistencia.justificado) {
      throw new AppError('Este registro ya fue justificado.', 409);
    }

    if (current.timestamp_salida) {
      throw new AppError('La justificación solo puede solicitarse mientras la marcación permanece abierta.', 400);
    }

    if (!current.timestamp_entrada) {
      throw new AppError('No existe una marcación de entrada para justificar.', 400);
    }

    const { windows } = await getAttendanceSettings();
    if (!puedeJustificarse(current.timestamp_entrada, current.horario, currentTime(), windows)) {
      throw new AppError('La justificación solo puede solicitarse dentro del tiempo de marcado de la clase.', 400);
    }

    const registro = await prisma.registroAsistencia.update({
      where: { id },
      data: { justificacion: data.justificacion },
      include: asistenciaInclude,
    });

    await registrarAuditoria({ userId: user.id, accion: 'SOLICITAR_JUSTIFICACION', tabla: TABLA_AUDITORIA, registroId: id, ip, datos: data });
    return registro;
  }

  async solicitarJustificacionHorario(horarioId: string, data: JustificarAsistenciaInput, user: AuthScope, ip: string) {
    if (user.rol !== Rol.docente) {
      throw new AppError('Solo los docentes pueden solicitar justificaciones.', 403);
    }

    const now = currentTime();
    const { windows } = await getAttendanceSettings();
    const diaSemana = ecuadorWeekday(now);
    const hoy = ecuadorDbDate(now);
    const horario = diaSemana
      ? await prisma.horario.findFirst({
          where: {
            id: horarioId,
            docente_id: user.id,
            dia_semana: diaSemana,
            activo: true,
            fecha_inicio_ciclo: { lte: hoy },
            fecha_fin_ciclo: { gte: hoy },
            materia: { activa: true },
          },
          select: { id: true, hora_inicio: true, hora_fin: true },
        })
      : null;

    if (!horario || !permiteEntrada(now, horario, windows)) {
      throw new AppError('La justificación solo puede solicitarse dentro del tiempo de marcado de la clase.', 400);
    }

    return withDocenteLock(user.id, async (tx) => {
      const existing = await this.findRegistroDelHorarioHoyIncluyendoJustificacion(user.id, horario.id, now, tx);
      if (existing) {
        throw new AppError('Ya existe una marcación o justificación registrada para esta clase.', 409);
      }

      const registro = await tx.registroAsistencia.create({
        data: {
          docente_id: user.id,
          horario_id: horario.id,
          estado: EstadoAsistencia.ausente,
          justificacion: data.justificacion,
          ip_entrada: ip,
          user_agent: 'justificacion_sin_marcación',
        },
        include: asistenciaInclude,
      });

      await registrarAuditoria(
        {
          userId: user.id,
          accion: 'SOLICITAR_JUSTIFICACION_HORARIO',
          tabla: TABLA_AUDITORIA,
          registroId: registro.id,
          ip,
          datos: { horario_id: horario.id, justificacion: data.justificacion },
        },
        tx
      );

      return registro;
    });
  }

  async aprobarJustificacion(id: string, user: AuthScope, ip: string) {
    const current = await this.getManageableRegistro(id, user);

    if (!current.justificacion) {
      throw new AppError('El registro no tiene justificación solicitada.', 400);
    }

    const registro = await prisma.registroAsistencia.update({
      where: { id },
      data: { estado: EstadoAsistencia.justificado },
      include: asistenciaInclude,
    });

    await registrarAuditoria({
      userId: user.id,
      accion: 'APROBAR_JUSTIFICACION',
      tabla: TABLA_AUDITORIA,
      registroId: id,
      ip,
      datos: { estado: EstadoAsistencia.justificado },
    });
    return registro;
  }

  async rechazarJustificacion(id: string, user: AuthScope, ip: string) {
    await this.getManageableRegistro(id, user);

    const registro = await prisma.registroAsistencia.update({
      where: { id },
      data: { justificacion: null },
      include: asistenciaInclude,
    });

    await registrarAuditoria({ userId: user.id, accion: 'RECHAZAR_JUSTIFICACION', tabla: TABLA_AUDITORIA, registroId: id, ip, datos: { justificacion: null } });
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

  /** Clase del día que admite marcar entrada en este momento; `null` si no hay (incluido domingo). */
  private async findHorarioActivo(docenteId: string, now: Date, windows: AttendanceWindows, db: DbClient = prisma) {
    const diaSemana = ecuadorWeekday(now);
    if (!diaSemana) return null;

    const hoy = ecuadorDbDate(now);
    const candidates = await db.horario.findMany({
      where: {
        docente_id: docenteId,
        dia_semana: diaSemana,
        activo: true,
        fecha_inicio_ciclo: { lte: hoy },
        fecha_fin_ciclo: { gte: hoy },
        materia: { activa: true },
      },
      include: {
        materia: { select: { id: true, nombre: true, codigo: true } },
      },
      orderBy: { hora_inicio: 'asc' },
    });

    return bloqueActivo(candidates, now, windows);
  }

  /** Marcación de clase de hoy sin salida, vigente o vencida. */
  private async findRegistroAbierto(docenteId: string, now: Date, db: DbClient = prisma) {
    return db.registroAsistencia.findFirst({
      where: {
        docente_id: docenteId,
        timestamp_salida: null,
        timestamp_entrada: ecuadorDayRange(now),
      },
      include: asistenciaInclude,
      orderBy: { timestamp_entrada: 'desc' },
    });
  }

  /** Marcación de clase abierta que todavía puede cerrarse. */
  private async findRegistroAbiertoVigente(docenteId: string, now: Date, windows: AttendanceWindows) {
    const registro = await this.findRegistroAbierto(docenteId, now);
    return registro && marcacionAbiertaVigente(registro.timestamp_entrada!, registro.horario.hora_fin, now, windows)
      ? registro
      : null;
  }

  private async findRegistroDelHorarioHoyIncluyendoJustificacion(docenteId: string, horarioId: string, date: Date, db: DbClient = prisma) {
    const hoy = ecuadorDayRange(date);
    return db.registroAsistencia.findFirst({
      where: {
        docente_id: docenteId,
        horario_id: horarioId,
        OR: [{ timestamp_entrada: hoy }, { timestamp_entrada: null, created_at: hoy }],
      },
      include: asistenciaInclude,
      orderBy: { created_at: 'desc' },
    });
  }
}

export const asistenciasService = new AsistenciasService();
