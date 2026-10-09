import { Prisma, Rol } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { registrarAuditoria } from '../../shared/attendance/audit';
import { currentTime, ecuadorDayRange, ecuadorDbDate, ecuadorWeekday } from '../../shared/attendance/clock';
import { withDocenteLock, type DbClient } from '../../shared/attendance/lock';
import { marcacionAbiertaQueBloquea } from '../../shared/attendance/openRecords';
import { saveAttendancePhoto } from '../../shared/attendance/photo';
import { getAttendanceSettings, type AttendanceWindows } from '../../shared/attendance/settings';
import { bloqueActivo, estadoEntrada, marcacionAbiertaVigente, ventanaSalida } from '../../shared/attendance/windows';
import type { AdministrativeLocationInput, HorarioAdministrativoInput, HorarioAdministrativoQueryInput, HorarioAdministrativoUpdateInput } from './horas-administrativas.schemas';

interface AuthScope { id: string; rol: string; }

const TABLA_AUDITORIA = 'horarios_administrativos';
const includeHorario = {
  docente: { select: { id: true, nombre: true, apellido: true, email: true } },
  periodo_academico: true,
} satisfies Prisma.HorarioAdministrativoInclude;
const includeRegistro = { horario_administrativo: { include: includeHorario } } satisfies Prisma.RegistroAdministrativoInclude;

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean { return startA < endB && startB < endA; }

export class HorasAdministrativasService {
  async list(filters: HorarioAdministrativoQueryInput, user: AuthScope) {
    const where: Prisma.HorarioAdministrativoWhereInput = {
      docente_id: user.rol === Rol.docente ? user.id : filters.docente_id,
      periodo_academico_id: filters.periodo_academico_id,
      dia_semana: filters.dia_semana,
      activo: filters.activo,
    };
    return prisma.horarioAdministrativo.findMany({ where, include: includeHorario, orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }] });
  }

  async listRecords() {
    return prisma.registroAdministrativo.findMany({
      include: includeRegistro,
      orderBy: [{ timestamp_entrada: 'desc' }, { created_at: 'desc' }],
      take: 100,
    });
  }

  async listOwnRecords(user: AuthScope) {
    return prisma.registroAdministrativo.findMany({
      where: { docente_id: user.id },
      include: includeRegistro,
      orderBy: [{ timestamp_entrada: 'desc' }, { created_at: 'desc' }],
      take: 100,
    });
  }

  async create(data: HorarioAdministrativoInput, user: AuthScope, ip: string) {
    await this.assertDocente(data.docente_id);
    const periodo = await this.assertPeriodo(data.periodo_academico_id);
    await this.assertNoOverlap(data, undefined);
    const horario = await prisma.horarioAdministrativo.create({ data: { ...data, fecha_inicio: periodo.fecha_inicio, fecha_fin: periodo.fecha_fin }, include: includeHorario });
    await registrarAuditoria({ userId: user.id, accion: 'CREATE_HORARIO_ADMINISTRATIVO', tabla: TABLA_AUDITORIA, registroId: horario.id, ip, datos: data });
    return horario;
  }

  async update(id: string, data: HorarioAdministrativoUpdateInput, user: AuthScope, ip: string) {
    const current = await prisma.horarioAdministrativo.findUnique({ where: { id } });
    if (!current) throw new AppError('Horario administrativo no encontrado.', 404);
    const next = { docente_id: data.docente_id ?? current.docente_id, periodo_academico_id: data.periodo_academico_id ?? current.periodo_academico_id, dia_semana: data.dia_semana ?? current.dia_semana, hora_inicio: data.hora_inicio ?? current.hora_inicio, hora_fin: data.hora_fin ?? current.hora_fin, jornada: data.jornada ?? current.jornada, modalidad: data.modalidad ?? current.modalidad, ubicacion: data.ubicacion ?? current.ubicacion ?? undefined, descripcion: data.descripcion ?? current.descripcion ?? undefined, activo: data.activo ?? current.activo };
    await this.assertDocente(next.docente_id);
    const periodo = await this.assertPeriodo(next.periodo_academico_id);
    await this.assertNoOverlap(next, id);
    const horario = await prisma.horarioAdministrativo.update({ where: { id }, data: { ...next, fecha_inicio: periodo.fecha_inicio, fecha_fin: periodo.fecha_fin }, include: includeHorario });
    await registrarAuditoria({ userId: user.id, accion: 'UPDATE_HORARIO_ADMINISTRATIVO', tabla: TABLA_AUDITORIA, registroId: id, ip, datos: data });
    return horario;
  }

  async deactivate(id: string, user: AuthScope, ip: string) {
    const horario = await prisma.horarioAdministrativo.update({ where: { id }, data: { activo: false }, include: includeHorario }).catch(() => { throw new AppError('Horario administrativo no encontrado.', 404); });
    await registrarAuditoria({ userId: user.id, accion: 'DEACTIVATE_HORARIO_ADMINISTRATIVO', tabla: TABLA_AUDITORIA, registroId: id, ip, datos: { activo: false } });
    return horario;
  }

  async estadoActual(user: AuthScope) {
    const now = currentTime();
    const { windows, photoRequired } = await getAttendanceSettings();
    const [open, horarioActivo, bloqueo] = await Promise.all([
      this.openRecord(user.id, now, windows),
      this.activeSchedule(user.id, now, windows),
      marcacionAbiertaQueBloquea(user.id, now, windows),
    ]);
    const marcadoHoy = horarioActivo ? await this.recordForScheduleToday(user.id, horarioActivo.id, now) : null;
    const salida = open ? ventanaSalida(open.timestamp_entrada!, open.horario_administrativo.hora_fin, windows) : null;
    return {
      horarioActivo,
      registroAbierto: open,
      puedeMarcarEntrada: !!horarioActivo && !bloqueo && !marcadoHoy,
      puedeMarcarSalida: !!salida && now >= salida.desde && now <= salida.hasta,
      attendancePhotoRequired: photoRequired,
      salidaDisponibleDesde: salida?.desde.toISOString() ?? null,
      salidaDisponibleHasta: salida?.hasta.toISOString() ?? null,
      salidaBloqueadaMotivo: salida && now < salida.desde ? `La salida se habilita ${windows.exitBeforeMinutes} minutos antes de finalizar la hora administrativa.` : null,
    };
  }

  async marcarEntrada(user: AuthScope, location: AdministrativeLocationInput, ip: string, userAgent?: string) {
    const now = currentTime();
    const { windows, photoRequired } = await getAttendanceSettings();
    return withDocenteLock(user.id, async (tx) => {
      const bloqueo = await marcacionAbiertaQueBloquea(user.id, now, windows, tx);
      if (bloqueo === 'administrativa') throw new AppError('Ya existe una asistencia administrativa abierta.', 409);
      if (bloqueo === 'clase') throw new AppError('Debe marcar salida de la clase antes de iniciar una hora administrativa.', 409);
      const horario = await this.activeSchedule(user.id, now, windows, tx);
      if (!horario) throw new AppError('No hay una hora administrativa activa dentro de la ventana de marcado.', 404);
      if (await this.recordForScheduleToday(user.id, horario.id, now, tx)) throw new AppError('Esta hora administrativa ya fue marcada.', 409);
      const estado = estadoEntrada(now, horario.hora_inicio, windows);
      if (estado === 'fuera_de_ventana') throw new AppError('La hora administrativa no está dentro de la ventana permitida.', 400);
      const registro = await tx.registroAdministrativo.create({ data: { docente_id: user.id, horario_administrativo_id: horario.id, timestamp_entrada: now, ip_entrada: ip, foto_entrada_url: await saveAttendancePhoto(location.foto_base64, user.id, 'administrativa-entrada', photoRequired), lat_entrada: location.lat, lng_entrada: location.lng, precision_entrada_m: location.precision_m, estado, user_agent: userAgent }, include: includeRegistro });
      await registrarAuditoria({ userId: user.id, accion: 'MARCAR_ENTRADA_ADMINISTRATIVA', tabla: TABLA_AUDITORIA, registroId: registro.id, ip, datos: { horario_administrativo_id: horario.id, estado } }, tx);
      return registro;
    });
  }

  async marcarSalida(user: AuthScope, location: AdministrativeLocationInput, ip: string) {
    const now = currentTime();
    const { windows, photoRequired } = await getAttendanceSettings();
    return withDocenteLock(user.id, async (tx) => {
      const open = await this.openRecord(user.id, now, null, tx);
      if (!open) throw new AppError('No tiene una asistencia administrativa abierta.', 404);
      const salida = ventanaSalida(open.timestamp_entrada!, open.horario_administrativo.hora_fin, windows);
      if (now < salida.desde) throw new AppError(`La salida se habilita ${windows.exitBeforeMinutes} minutos antes de finalizar la hora administrativa.`, 400);
      if (now > salida.hasta) throw new AppError('El tiempo para marcar salida terminó.', 400);
      const registro = await tx.registroAdministrativo.update({ where: { id: open.id }, data: { timestamp_salida: now, ip_salida: ip, foto_salida_url: await saveAttendancePhoto(location.foto_base64, user.id, 'administrativa-salida', photoRequired), lat_salida: location.lat, lng_salida: location.lng, precision_salida_m: location.precision_m }, include: includeRegistro });
      await registrarAuditoria({ userId: user.id, accion: 'MARCAR_SALIDA_ADMINISTRATIVA', tabla: TABLA_AUDITORIA, registroId: registro.id, ip, datos: { horario_administrativo_id: registro.horario_administrativo_id } }, tx);
      return registro;
    });
  }

  /** Hora administrativa del día que admite marcar entrada en este momento; `null` si no hay (incluido domingo). */
  private async activeSchedule(docenteId: string, now: Date, windows: AttendanceWindows, db: DbClient = prisma) {
    const diaSemana = ecuadorWeekday(now);
    if (!diaSemana) return null;
    const hoy = ecuadorDbDate(now);
    const schedules = await db.horarioAdministrativo.findMany({ where: { docente_id: docenteId, dia_semana: diaSemana, activo: true, fecha_inicio: { lte: hoy }, fecha_fin: { gte: hoy } }, include: includeHorario, orderBy: { hora_inicio: 'asc' } });
    return bloqueActivo(schedules, now, windows);
  }
  /** Marcación administrativa de hoy sin salida. Con `windows`, solo si todavía puede cerrarse. */
  private async openRecord(docenteId: string, now: Date, windows: AttendanceWindows | null, db: DbClient = prisma) {
    const registro = await db.registroAdministrativo.findFirst({ where: { docente_id: docenteId, timestamp_salida: null, timestamp_entrada: ecuadorDayRange(now) }, include: includeRegistro, orderBy: { timestamp_entrada: 'desc' } });
    if (!registro || !windows) return registro;
    return marcacionAbiertaVigente(registro.timestamp_entrada!, registro.horario_administrativo.hora_fin, now, windows) ? registro : null;
  }
  private recordForScheduleToday(docenteId: string, horarioId: string, now: Date, db: DbClient = prisma) { return db.registroAdministrativo.findFirst({ where: { docente_id: docenteId, horario_administrativo_id: horarioId, timestamp_entrada: ecuadorDayRange(now) }, select: { id: true } }); }
  private async assertDocente(id: string) { const docente = await prisma.user.findUnique({ where: { id }, select: { rol: true, activo: true } }); if (!docente || !docente.activo || docente.rol !== Rol.docente) throw new AppError('Docente no encontrado o inactivo.', 404); }
  private async assertPeriodo(id: string) { const periodo = await prisma.periodoAcademico.findUnique({ where: { id } }); if (!periodo || !periodo.activo) throw new AppError('Período académico no encontrado o inactivo.', 404); return periodo; }
  private async assertNoOverlap(data: Pick<HorarioAdministrativoInput, 'docente_id' | 'periodo_academico_id' | 'dia_semana' | 'hora_inicio' | 'hora_fin' | 'activo'>, excludeId?: string) {
    if (!data.activo) return;
    const [administrativos, academicos] = await Promise.all([
      prisma.horarioAdministrativo.findMany({ where: { id: excludeId ? { not: excludeId } : undefined, docente_id: data.docente_id, periodo_academico_id: data.periodo_academico_id, dia_semana: data.dia_semana, activo: true }, select: { hora_inicio: true, hora_fin: true } }),
      prisma.horario.findMany({ where: { docente_id: data.docente_id, periodo_academico_id: data.periodo_academico_id, dia_semana: data.dia_semana, activo: true }, select: { hora_inicio: true, hora_fin: true } }),
    ]);
    if ([...administrativos, ...academicos].some((item) => overlaps(data.hora_inicio, data.hora_fin, item.hora_inicio, item.hora_fin))) throw new AppError('Este bloque se cruza con una clase u hora administrativa activa del docente.', 409);
  }
}
export const horasAdministrativasService = new HorasAdministrativasService();
