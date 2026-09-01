import { DiaSemana, EstadoAsistencia, Prisma, Rol } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { calcularEstadoAsistencia, nowInEcuador } from '../../shared/utils/timezone';
import { getAttendanceWindows, type AttendanceWindowSettings } from '../../shared/utils/attendanceSettings';
import type { JustificarAsistenciaInput, ListAsistenciasQueryInput, LocationInput } from './asistencias.schemas';

interface AuthScope {
  id: string;
  rol: string;
}

const attendanceUploadsDir = path.resolve(process.cwd(), 'uploads', 'asistencias');

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
    throw new AppError('No existen horarios académicos configurados para domingo.', 404);
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

function timeOnDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const value = new Date(date);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function subtractMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60_000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function horarioPermiteIngreso(now: Date, horaInicio: string, horaFin: string, windows: AttendanceWindowSettings): boolean {
  const classEnd = timeOnDate(now, horaFin);
  return now <= classEnd && calcularEstadoAsistencia(now, horaInicio, now, windows.entryBeforeMinutes, windows.entryAfterMinutes) !== 'fuera_de_ventana';
}

function getOpenAttendanceStatus(
  registro: {
    timestamp_entrada: Date | null;
    timestamp_salida: Date | null;
    justificacion: string | null;
    horario: { hora_inicio: string; hora_fin: string };
  },
  now: Date
) {
  if (!registro.timestamp_entrada || registro.timestamp_salida || registro.justificacion) {
    return { estado_operativo: null, puede_solicitar_justificacion: false };
  }

  const classEnd = timeOnDate(registro.timestamp_entrada, registro.horario.hora_fin);
  const exitDeadline = addMinutes(classEnd, 15);
  const entryJustificationDeadline = addMinutes(
    timeOnDate(registro.timestamp_entrada, registro.horario.hora_inicio),
    15
  );

  return {
    estado_operativo: now <= classEnd ? 'en_curso' : 'salida_pendiente',
    puede_solicitar_justificacion: now <= entryJustificationDeadline || now > exitDeadline,
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

async function isAttendancePhotoRequired(): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'attendance_photo_required' },
    select: { value: true },
  });

  return setting?.value !== 'false';
}

async function saveAttendancePhoto(
  photoBase64: string | undefined,
  userId: string,
  type: 'entrada' | 'salida',
  required: boolean
): Promise<string | null> {
  if (!photoBase64) {
    if (!required) return null;
    throw new AppError('Debe capturar una foto con la cámara para registrar la asistencia.', 400);
  }

  const match = photoBase64.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
  if (!match) {
    throw new AppError('La foto enviada no tiene un formato válido.', 400);
  }

  const extension = match[1] === 'png' ? 'png' : 'jpg';
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length > 650_000) {
    throw new AppError('La foto de asistencia supera el tamaño permitido.', 413);
  }

  await fs.mkdir(attendanceUploadsDir, { recursive: true });

  const safeUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `${safeUserId}-${type}-${Date.now()}.${extension}`;
  const filePath = path.join(attendanceUploadsDir, filename);
  await fs.writeFile(filePath, buffer);

  return `/uploads/asistencias/${filename}`;
}

export class AsistenciasService {
  async getEstadoActual(user: AuthScope) {
    if (user.rol !== Rol.docente) {
      throw new AppError('El estado actual de clase aplica solo para docentes.', 403);
    }

    const now = nowInEcuador();
    const windows = await getAttendanceWindows();
    const horario = await this.findHorarioActivo(user.id, now, windows);
    const registroAbiertoEncontrado = await this.findRegistroAbierto(user.id);
    const registroAdministrativoAbierto = await prisma.registroAdministrativo.findFirst({
      where: {
        docente_id: user.id,
        timestamp_salida: null,
        timestamp_entrada: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      select: { id: true },
    });
    const registroAbierto =
      registroAbiertoEncontrado &&
      now <=
        addMinutes(
          timeOnDate(registroAbiertoEncontrado.timestamp_entrada!, registroAbiertoEncontrado.horario.hora_fin),
          windows.exitAfterMinutes
        )
        ? registroAbiertoEncontrado
        : null;
    const registroDelHorario = horario
      ? await this.findRegistroDelHorarioHoyIncluyendoJustificacion(user.id, horario.id, now)
      : null;
    const salidaDisponibleDesde = registroAbierto
      ? subtractMinutes(timeOnDate(now, registroAbierto.horario.hora_fin), windows.exitBeforeMinutes)
      : null;
    const salidaDisponibleHasta = registroAbierto
      ? addMinutes(timeOnDate(now, registroAbierto.horario.hora_fin), windows.exitAfterMinutes)
      : null;
    const puedeMarcarSalida =
      !!registroAbierto &&
      !!salidaDisponibleDesde &&
      !!salidaDisponibleHasta &&
      now >= salidaDisponibleDesde &&
      now <= salidaDisponibleHasta;
    const attendancePhotoRequired = await isAttendancePhotoRequired();

    return {
      horarioActivo: horario,
      registroAbierto,
      puedeMarcarEntrada: !!horario && !registroAbierto && !registroAdministrativoAbierto && !registroDelHorario,
      puedeMarcarSalida,
      attendancePhotoRequired,
      salidaDisponibleDesde: salidaDisponibleDesde?.toISOString() ?? null,
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

    const now = nowInEcuador();
    const windows = await getAttendanceWindows();
    const open = await this.findRegistroAbierto(user.id);
    const openIsActionable =
      open && now <= addMinutes(timeOnDate(open.timestamp_entrada!, open.horario.hora_fin), windows.exitAfterMinutes);
    if (openIsActionable) {
      throw new AppError('Ya existe una asistencia abierta. Marque salida antes de registrar otro ingreso.', 409);
    }
    const administrativeOpen = await prisma.registroAdministrativo.findFirst({
      where: {
        docente_id: user.id,
        timestamp_salida: null,
        timestamp_entrada: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      select: { id: true },
    });
    if (administrativeOpen) {
      throw new AppError('Debe marcar salida de la hora administrativa antes de iniciar una clase.', 409);
    }

    const horario = await this.findHorarioActivo(user.id, now, windows);
    if (!horario) {
      throw new AppError('No hay una clase activa dentro de la ventana de marcado.', 404);
    }

    const alreadyMarked = await this.findRegistroDelHorarioHoyIncluyendoJustificacion(user.id, horario.id, now);
    if (alreadyMarked) {
      throw new AppError('La asistencia de esta clase ya fue registrada. No puede marcar ingreso nuevamente.', 409);
    }

    const estadoCalculado = calcularEstadoAsistencia(now, horario.hora_inicio, now, windows.entryBeforeMinutes, windows.entryAfterMinutes);
    if (estadoCalculado === 'fuera_de_ventana') {
      throw new AppError('La clase no esta dentro de la ventana permitida de marcado.', 400);
    }

    const photoRequired = await isAttendancePhotoRequired();
    const registro = await prisma.registroAsistencia.create({
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
        estado: estadoCalculado,
        user_agent: userAgent,
      },
      include: asistenciaInclude,
    });

    await this.audit(user.id, 'MARCAR_ENTRADA', registro.id, ip, {
      horario_id: horario.id,
      estado: estadoCalculado,
      foto_entrada_url: registro.foto_entrada_url,
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

    const now = nowInEcuador();
    const windows = await getAttendanceWindows();
    const salidaDisponibleDesde = subtractMinutes(timeOnDate(now, open.horario.hora_fin), windows.exitBeforeMinutes);
    if (now < salidaDisponibleDesde) {
      throw new AppError(`La salida se habilita ${windows.exitBeforeMinutes} minutos antes de la hora de fin de la clase.`, 400);
    }
    const salidaDisponibleHasta = addMinutes(timeOnDate(now, open.horario.hora_fin), windows.exitAfterMinutes);
    if (now > salidaDisponibleHasta) {
      throw new AppError('El tiempo para marcar salida terminó. Solicite una justificación.', 400);
    }

    const photoRequired = await isAttendancePhotoRequired();
    const registro = await prisma.registroAsistencia.update({
      data: {
        timestamp_salida: now,
        ip_salida: ip,
        foto_salida_url: await saveAttendancePhoto(location.foto_base64, user.id, 'salida', photoRequired),
        lat: location.lat ?? open.lat,
        lng: location.lng ?? open.lng,
        precision_m: location.precision_m ?? open.precision_m,
      },
      include: asistenciaInclude,
      where: { id: open.id },
    });

    await this.audit(user.id, 'MARCAR_SALIDA', registro.id, ip, {
      horario_id: registro.horario_id,
      foto_salida_url: registro.foto_salida_url,
    });

    return registro;
  }

  async list(filters: ListAsistenciasQueryInput, user: AuthScope) {
    const registros = await prisma.registroAsistencia.findMany({
      where: {
        AND: [buildRoleWhere(user), buildFiltersWhere(filters)],
      },
      include: asistenciaInclude,
      orderBy: [{ timestamp_entrada: 'desc' }, { created_at: 'desc' }],
      take: 100,
    });

    const now = nowInEcuador();
    return registros.map((registro) => ({
      ...registro,
      ...getOpenAttendanceStatus(registro, now),
    }));
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

    if (current.timestamp_salida) {
      throw new AppError('La justificación solo puede solicitarse mientras la marcación permanece abierta.', 400);
    }

    if (!current.timestamp_entrada) {
      throw new AppError('No existe una marcación de entrada para justificar.', 400);
    }

    const now = nowInEcuador();
    const entryJustificationDeadline = addMinutes(
      timeOnDate(current.timestamp_entrada, current.horario.hora_inicio),
      15
    );
    const exitDeadline = addMinutes(
      timeOnDate(current.timestamp_entrada, current.horario.hora_fin),
      15
    );
    if (now > entryJustificationDeadline && now <= exitDeadline) {
      throw new AppError('La justificación solo puede solicitarse dentro del tiempo de marcado de la clase.', 400);
    }

    const registro = await prisma.registroAsistencia.update({
      where: { id },
      data: { justificacion: data.justificacion },
      include: asistenciaInclude,
    });

    await this.audit(user.id, 'SOLICITAR_JUSTIFICACION', id, ip, data);
    return registro;
  }

  async solicitarJustificacionHorario(horarioId: string, data: JustificarAsistenciaInput, user: AuthScope, ip: string) {
    if (user.rol !== Rol.docente) {
      throw new AppError('Solo los docentes pueden solicitar justificaciones.', 403);
    }

    const now = nowInEcuador();
    const horario = await prisma.horario.findFirst({
      where: {
        id: horarioId,
        activo: true,
        fecha_inicio_ciclo: { lte: now },
        fecha_fin_ciclo: { gte: now },
        docente_id: user.id,
        materia: {
          activa: true,
        },
      },
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
    });

    const windows = await getAttendanceWindows();
    if (!horario || !horarioPermiteIngreso(now, horario.hora_inicio, horario.hora_fin, windows)) {
      throw new AppError('La justificación solo puede solicitarse dentro del tiempo de marcado de la clase.', 400);
    }

    const existing = await this.findRegistroDelHorarioHoyIncluyendoJustificacion(user.id, horario.id, now);
    if (existing) {
      throw new AppError('Ya existe una marcación o justificación registrada para esta clase.', 409);
    }

    const registro = await prisma.registroAsistencia.create({
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

    await this.audit(user.id, 'SOLICITAR_JUSTIFICACION_HORARIO', registro.id, ip, {
      horario_id: horario.id,
      justificacion: data.justificacion,
    });

    return registro;
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

  private async findHorarioActivo(docenteId: string, now: Date, windows: AttendanceWindowSettings) {
    const diaSemana = getDiaSemana(now);

    const candidates = await prisma.horario.findMany({
      where: {
        dia_semana: diaSemana,
        activo: true,
        fecha_inicio_ciclo: { lte: now },
        fecha_fin_ciclo: { gte: now },
        docente_id: docenteId,
        materia: {
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

    return candidates.find((horario) => horarioPermiteIngreso(now, horario.hora_inicio, horario.hora_fin, windows)) ?? null;
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

  private async findRegistroDelHorarioHoyIncluyendoJustificacion(docenteId: string, horarioId: string, date: Date) {
    return prisma.registroAsistencia.findFirst({
      where: {
        docente_id: docenteId,
        horario_id: horarioId,
        OR: [
          {
            timestamp_entrada: {
              gte: startOfDay(date),
              lte: endOfDay(date),
            },
          },
          {
            timestamp_entrada: null,
            created_at: {
              gte: startOfDay(date),
              lte: endOfDay(date),
            },
          },
        ],
      },
      include: asistenciaInclude,
      orderBy: { created_at: 'desc' },
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
