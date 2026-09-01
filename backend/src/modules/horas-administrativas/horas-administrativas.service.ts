import { DiaSemana, Prisma, Rol } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { calcularEstadoAsistencia, nowInEcuador } from '../../shared/utils/timezone';
import { getAttendanceWindows, type AttendanceWindowSettings } from '../../shared/utils/attendanceSettings';
import type { AdministrativeLocationInput, HorarioAdministrativoInput, HorarioAdministrativoQueryInput, HorarioAdministrativoUpdateInput } from './horas-administrativas.schemas';

interface AuthScope { id: string; rol: string; }

const uploadsDir = path.resolve(process.cwd(), 'uploads', 'asistencias');
const includeHorario = {
  docente: { select: { id: true, nombre: true, apellido: true, email: true } },
  periodo_academico: true,
} satisfies Prisma.HorarioAdministrativoInclude;
const includeRegistro = { horario_administrativo: { include: includeHorario } } satisfies Prisma.RegistroAdministrativoInclude;

function dayOfWeek(date: Date): DiaSemana {
  const values: Record<number, DiaSemana> = { 1: DiaSemana.lunes, 2: DiaSemana.martes, 3: DiaSemana.miercoles, 4: DiaSemana.jueves, 5: DiaSemana.viernes, 6: DiaSemana.sabado };
  const value = values[date.getDay()];
  if (!value) throw new AppError('No existen horarios administrativos configurados para domingo.', 404);
  return value;
}
function onDate(date: Date, time: string): Date { const [hours, minutes] = time.split(':').map(Number); const value = new Date(date); value.setHours(hours, minutes, 0, 0); return value; }
function addMinutes(date: Date, minutes: number): Date { return new Date(date.getTime() + minutes * 60_000); }
function subtractMinutes(date: Date, minutes: number): Date { return addMinutes(date, -minutes); }
function startOfDay(date: Date): Date { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; }
function endOfDay(date: Date): Date { const value = new Date(date); value.setHours(23, 59, 59, 999); return value; }
function overlaps(startA: string, endA: string, startB: string, endB: string): boolean { return startA < endB && startB < endA; }

async function photoRequired(): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'attendance_photo_required' }, select: { value: true } });
  return setting?.value !== 'false';
}
async function savePhoto(value: string | undefined, userId: string, type: 'entrada' | 'salida', required: boolean): Promise<string | null> {
  if (!value) { if (!required) return null; throw new AppError('Debe capturar una foto para registrar la asistencia.', 400); }
  const match = value.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
  if (!match) throw new AppError('La foto enviada no tiene un formato válido.', 400);
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 650_000) throw new AppError('La foto de asistencia supera el tamaño permitido.', 413);
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `${userId.replace(/[^a-zA-Z0-9-]/g, '')}-administrativa-${type}-${Date.now()}.${match[1] === 'png' ? 'png' : 'jpg'}`;
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/asistencias/${filename}`;
}

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
    await this.audit(user.id, 'CREATE_HORARIO_ADMINISTRATIVO', horario.id, ip, data);
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
    await this.audit(user.id, 'UPDATE_HORARIO_ADMINISTRATIVO', id, ip, data);
    return horario;
  }

  async deactivate(id: string, user: AuthScope, ip: string) {
    const horario = await prisma.horarioAdministrativo.update({ where: { id }, data: { activo: false }, include: includeHorario }).catch(() => { throw new AppError('Horario administrativo no encontrado.', 404); });
    await this.audit(user.id, 'DEACTIVATE_HORARIO_ADMINISTRATIVO', id, ip, { activo: false });
    return horario;
  }

  async estadoActual(user: AuthScope) {
    const now = nowInEcuador();
    const windows = await getAttendanceWindows();
    const open = await this.openRecord(user.id, now);
    const horarioActivo = await this.activeSchedule(user.id, now, windows);
    const salidaDesde = open ? subtractMinutes(onDate(now, open.horario_administrativo.hora_fin), windows.exitBeforeMinutes) : null;
    const salidaHasta = open ? addMinutes(onDate(now, open.horario_administrativo.hora_fin), windows.exitAfterMinutes) : null;
    const classOpen = await prisma.registroAsistencia.findFirst({ where: { docente_id: user.id, timestamp_salida: null, timestamp_entrada: { gte: startOfDay(now), lte: endOfDay(now) } }, select: { id: true } });
    return { horarioActivo, registroAbierto: open, puedeMarcarEntrada: !!horarioActivo && !open && !classOpen, puedeMarcarSalida: !!open && !!salidaDesde && !!salidaHasta && now >= salidaDesde && now <= salidaHasta, attendancePhotoRequired: await photoRequired(), salidaDisponibleDesde: salidaDesde?.toISOString() ?? null, salidaDisponibleHasta: salidaHasta?.toISOString() ?? null, salidaBloqueadaMotivo: open && salidaDesde && now < salidaDesde ? `La salida se habilita ${windows.exitBeforeMinutes} minutos antes de finalizar la hora administrativa.` : null };
  }

  async marcarEntrada(user: AuthScope, location: AdministrativeLocationInput, ip: string, userAgent?: string) {
    const now = nowInEcuador();
    const windows = await getAttendanceWindows();
    if (await this.openRecord(user.id, now)) throw new AppError('Ya existe una asistencia administrativa abierta.', 409);
    const classOpen = await prisma.registroAsistencia.findFirst({ where: { docente_id: user.id, timestamp_salida: null, timestamp_entrada: { gte: startOfDay(now), lte: endOfDay(now) } }, select: { id: true } });
    if (classOpen) throw new AppError('Debe marcar salida de la clase antes de iniciar una hora administrativa.', 409);
    const horario = await this.activeSchedule(user.id, now, windows);
    if (!horario) throw new AppError('No hay una hora administrativa activa dentro de la ventana de marcado.', 404);
    const existing = await prisma.registroAdministrativo.findFirst({ where: { docente_id: user.id, horario_administrativo_id: horario.id, timestamp_entrada: { gte: startOfDay(now), lte: endOfDay(now) } } });
    if (existing) throw new AppError('Esta hora administrativa ya fue marcada.', 409);
    const estado = calcularEstadoAsistencia(now, horario.hora_inicio, now, windows.entryBeforeMinutes, windows.entryAfterMinutes);
    if (estado === 'fuera_de_ventana') throw new AppError('La hora administrativa no está dentro de la ventana permitida.', 400);
    const registro = await prisma.registroAdministrativo.create({ data: { docente_id: user.id, horario_administrativo_id: horario.id, timestamp_entrada: now, ip_entrada: ip, foto_entrada_url: await savePhoto(location.foto_base64, user.id, 'entrada', await photoRequired()), lat_entrada: location.lat, lng_entrada: location.lng, precision_entrada_m: location.precision_m, estado, user_agent: userAgent }, include: includeRegistro });
    await this.audit(user.id, 'MARCAR_ENTRADA_ADMINISTRATIVA', registro.id, ip, { horario_administrativo_id: horario.id, estado });
    return registro;
  }

  async marcarSalida(user: AuthScope, location: AdministrativeLocationInput, ip: string) {
    const now = nowInEcuador();
    const windows = await getAttendanceWindows();
    const open = await this.openRecord(user.id, now);
    if (!open) throw new AppError('No tiene una asistencia administrativa abierta.', 404);
    if (now < subtractMinutes(onDate(now, open.horario_administrativo.hora_fin), windows.exitBeforeMinutes)) throw new AppError(`La salida se habilita ${windows.exitBeforeMinutes} minutos antes de finalizar la hora administrativa.`, 400);
    if (now > addMinutes(onDate(now, open.horario_administrativo.hora_fin), windows.exitAfterMinutes)) throw new AppError('El tiempo para marcar salida terminó.', 400);
    const registro = await prisma.registroAdministrativo.update({ where: { id: open.id }, data: { timestamp_salida: now, ip_salida: ip, foto_salida_url: await savePhoto(location.foto_base64, user.id, 'salida', await photoRequired()), lat_salida: location.lat, lng_salida: location.lng, precision_salida_m: location.precision_m }, include: includeRegistro });
    await this.audit(user.id, 'MARCAR_SALIDA_ADMINISTRATIVA', registro.id, ip, { horario_administrativo_id: registro.horario_administrativo_id });
    return registro;
  }

  private async activeSchedule(docenteId: string, now: Date, windows: AttendanceWindowSettings) {
    const schedules = await prisma.horarioAdministrativo.findMany({ where: { docente_id: docenteId, dia_semana: dayOfWeek(now), activo: true, fecha_inicio: { lte: now }, fecha_fin: { gte: now } }, include: includeHorario, orderBy: { hora_inicio: 'asc' } });
    return schedules.find((item) => now <= onDate(now, item.hora_fin) && calcularEstadoAsistencia(now, item.hora_inicio, now, windows.entryBeforeMinutes, windows.entryAfterMinutes) !== 'fuera_de_ventana') ?? null;
  }
  private openRecord(docenteId: string, now: Date) { return prisma.registroAdministrativo.findFirst({ where: { docente_id: docenteId, timestamp_salida: null, timestamp_entrada: { gte: startOfDay(now), lte: endOfDay(now) } }, include: includeRegistro, orderBy: { timestamp_entrada: 'desc' } }); }
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
  private audit(userId: string, action: string, recordId: string, ip: string, payload: unknown) { return prisma.auditLog.create({ data: { user_id: userId, accion: action, tabla_afectada: 'horarios_administrativos', registro_id: recordId, ip, datos_nuevos: payload as Prisma.InputJsonValue } }); }
}
export const horasAdministrativasService = new HorasAdministrativasService();
