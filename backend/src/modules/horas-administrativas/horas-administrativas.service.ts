import { randomUUID } from 'node:crypto';
import { Prisma, Rol, type DiaSemana } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { registrarAuditoria } from '../../shared/attendance/audit';
import { currentTime, ecuadorDayRange, ecuadorDbDate, ecuadorWeekday } from '../../shared/attendance/clock';
import { getDiaNoLaborable, mensajeDiaNoLaborable } from '../../shared/attendance/calendar';
import { withDocenteLock, type DbClient } from '../../shared/attendance/lock';
import { marcacionAbiertaQueBloquea } from '../../shared/attendance/openRecords';
import { saveAttendancePhoto } from '../../shared/attendance/photo';
import { getAttendanceSettings, type AttendanceWindows } from '../../shared/attendance/settings';
import { bloqueActivo, estadoEntrada, marcacionAbiertaVigente, ventanaSalida } from '../../shared/attendance/windows';
import { bloquesDelDia, formatFecha, jornadaPorHora } from './jornada';
import type { AdministrativeLocationInput, HorarioAdministrativoInput, HorarioAdministrativoQueryInput, HorarioAdministrativoUpdateInput, JornadaAdministrativaInput, JornadasVariosDocentesInput } from './horas-administrativas.schemas';

interface AuthScope { id: string; rol: string; }

const TABLA_AUDITORIA = 'horarios_administrativos';
const includeHorario = {
  docente: { select: { id: true, nombre: true, apellido: true, email: true } },
  periodo_academico: true,
} satisfies Prisma.HorarioAdministrativoInclude;
const includeRegistro = { horario_administrativo: { include: includeHorario } } satisfies Prisma.RegistroAdministrativoInclude;

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean { return startA < endB && startB < endA; }

const DIA_LABEL: Record<DiaSemana, string> = { lunes: 'lunes', martes: 'martes', miercoles: 'miércoles', jueves: 'jueves', viernes: 'viernes', sabado: 'sábado' };
const bloqueKey = (bloque: { dia_semana: string; hora_inicio: string; hora_fin: string }) => `${bloque.dia_semana}|${bloque.hora_inicio}|${bloque.hora_fin}`;
const dbDate = (key: string) => new Date(`${key}T00:00:00Z`);

export class HorasAdministrativasService {
  async list(filters: HorarioAdministrativoQueryInput, user: AuthScope) {
    if (filters.hoy) {
      const now = currentTime();
      const dia = ecuadorWeekday(now);
      const docenteId = user.rol === Rol.docente ? user.id : filters.docente_id;
      if (!dia || !docenteId) return [];
      return this.bloquesDeHoy(docenteId, now, dia);
    }
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
    const horario = await prisma.horarioAdministrativo.create({ data: { ...data, fecha_inicio: periodo.fecha_inicio, fecha_fin: periodo.fecha_fin, grupo_id: randomUUID() }, include: includeHorario });
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
    // Un bloque de jornada temporal conserva sus fechas; el regular sigue al período.
    const vigencia = current.temporal ? {} : { fecha_inicio: periodo.fecha_inicio, fecha_fin: periodo.fecha_fin };
    const horario = await prisma.horarioAdministrativo.update({ where: { id }, data: { ...next, ...vigencia }, include: includeHorario });
    await registrarAuditoria({ userId: user.id, accion: 'UPDATE_HORARIO_ADMINISTRATIVO', tabla: TABLA_AUDITORIA, registroId: id, ip, datos: data });
    return horario;
  }

  async deactivate(id: string, user: AuthScope, ip: string) {
    const horario = await prisma.horarioAdministrativo.update({ where: { id }, data: { activo: false }, include: includeHorario }).catch(() => { throw new AppError('Horario administrativo no encontrado.', 404); });
    await registrarAuditoria({ userId: user.id, accion: 'DEACTIVATE_HORARIO_ADMINISTRATIVO', tabla: TABLA_AUDITORIA, registroId: id, ip, datos: { activo: false } });
    return horario;
  }

  /** Crea una jornada: todos sus bloques o ninguno. */
  async createJornada(data: JornadaAdministrativaInput, user: AuthScope, ip: string) {
    return this.guardarJornada(randomUUID(), data, user, ip, 'CREATE_JORNADA_ADMINISTRATIVA');
  }

  /**
   * Crea la misma jornada para varios docentes, una independiente por cada uno.
   * El guardado es parcial: un docente con cruce no impide registrar a los
   * demás, y su motivo se devuelve en `fallidas`.
   */
  async createJornadas(data: JornadasVariosDocentesInput, user: AuthScope, ip: string) {
    const { docente_ids, ...jornada } = data;
    const creadas: Array<{ docente_id: string; grupo_id: string; bloques: number }> = [];
    const fallidas: Array<{ docente_id: string; mensaje: string }> = [];
    for (const docente_id of docente_ids) {
      try {
        const bloques = await this.createJornada({ ...jornada, docente_id }, user, ip);
        creadas.push({ docente_id, grupo_id: bloques[0].grupo_id, bloques: bloques.length });
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        fallidas.push({ docente_id, mensaje: error.message });
      }
    }
    return { creadas, fallidas };
  }

  /**
   * Reemplaza los bloques de una jornada. Los bloques que siguen (mismo día y
   * horario, y mismo docente y período) se actualizan y conservan sus
   * marcaciones; los quitados se desactivan, nunca se borran.
   */
  async updateJornada(grupoId: string, data: JornadaAdministrativaInput, user: AuthScope, ip: string) {
    const existe = await prisma.horarioAdministrativo.findFirst({ where: { grupo_id: grupoId, activo: true }, select: { id: true } });
    if (!existe) throw new AppError('Jornada administrativa no encontrada.', 404);
    return this.guardarJornada(grupoId, data, user, ip, 'UPDATE_JORNADA_ADMINISTRATIVA');
  }

  async deactivateJornada(grupoId: string, user: AuthScope, ip: string) {
    const { count } = await prisma.horarioAdministrativo.updateMany({ where: { grupo_id: grupoId, activo: true }, data: { activo: false } });
    if (count === 0) throw new AppError('Jornada administrativa no encontrada.', 404);
    await registrarAuditoria({ userId: user.id, accion: 'DEACTIVATE_JORNADA_ADMINISTRATIVA', tabla: TABLA_AUDITORIA, registroId: grupoId, ip, datos: { bloques: count } });
    return { grupo_id: grupoId, bloques: count };
  }

  async estadoActual(user: AuthScope) {
    const now = currentTime();
    const { windows, photoRequired } = await getAttendanceSettings();
    const [diaNoLaborable, open, bloqueDelDia, bloqueo] = await Promise.all([
      getDiaNoLaborable(now),
      this.openRecord(user.id, now, windows),
      this.activeSchedule(user.id, now, windows),
      marcacionAbiertaQueBloquea(user.id, now, windows),
    ]);
    // En un feriado no hay bloque activo; una marcación abierta previa sí puede cerrarse.
    const horarioActivo = diaNoLaborable ? null : bloqueDelDia;
    const marcadoHoy = horarioActivo ? await this.recordForScheduleToday(user.id, horarioActivo.id, now) : null;
    const salida = open ? ventanaSalida(open.timestamp_entrada!, open.horario_administrativo.hora_fin, windows) : null;
    return {
      horarioActivo,
      diaNoLaborable,
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
      const diaNoLaborable = await getDiaNoLaborable(now, tx);
      if (diaNoLaborable) throw new AppError(mensajeDiaNoLaborable(diaNoLaborable), 409);
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
    return bloqueActivo(await this.bloquesDeHoy(docenteId, now, diaSemana, db), now, windows);
  }

  /** Bloques que el docente debe cumplir hoy: una jornada temporal vigente pausa la regular. */
  private async bloquesDeHoy(docenteId: string, now: Date, dia: DiaSemana, db: DbClient = prisma) {
    const hoy = ecuadorDbDate(now);
    const vigentes = await db.horarioAdministrativo.findMany({ where: { docente_id: docenteId, activo: true, fecha_inicio: { lte: hoy }, fecha_fin: { gte: hoy } }, include: includeHorario, orderBy: { hora_inicio: 'asc' } });
    return bloquesDelDia(vigentes, dia);
  }

  private async guardarJornada(grupoId: string, data: JornadaAdministrativaInput, user: AuthScope, ip: string, accion: string) {
    await this.assertDocente(data.docente_id);
    const periodo = await this.assertPeriodo(data.periodo_academico_id);
    const temporal = !!data.fecha_inicio;
    const fecha_inicio = data.fecha_inicio ? dbDate(data.fecha_inicio) : periodo.fecha_inicio;
    const fecha_fin = data.fecha_fin ? dbDate(data.fecha_fin) : periodo.fecha_fin;
    if (temporal && (fecha_inicio < periodo.fecha_inicio || fecha_fin > periodo.fecha_fin)) {
      throw new AppError(`Las fechas de la jornada temporal deben estar dentro del período (${formatFecha(periodo.fecha_inicio)} al ${formatFecha(periodo.fecha_fin)}).`, 400);
    }
    const comunes = { docente_id: data.docente_id, periodo_academico_id: data.periodo_academico_id, modalidad: data.modalidad, ubicacion: data.ubicacion || null, descripcion: data.descripcion || null, fecha_inicio, fecha_fin, temporal, grupo_id: grupoId };

    return withDocenteLock(data.docente_id, async (tx) => {
      await this.assertJornadaSinCruces(tx, data, grupoId, { temporal, fecha_inicio, fecha_fin });
      const actuales = await tx.horarioAdministrativo.findMany({ where: { grupo_id: grupoId, activo: true } });
      const reutilizables = new Map(
        actuales.filter((bloque) => bloque.docente_id === data.docente_id && bloque.periodo_academico_id === data.periodo_academico_id).map((bloque) => [bloqueKey(bloque), bloque])
      );
      const conservados = new Set<string>();
      for (const bloque of data.bloques) {
        const existente = reutilizables.get(bloqueKey(bloque));
        const fila = { ...comunes, ...bloque, jornada: jornadaPorHora(bloque.hora_inicio) };
        if (existente) {
          conservados.add(existente.id);
          await tx.horarioAdministrativo.update({ where: { id: existente.id }, data: fila });
        } else {
          await tx.horarioAdministrativo.create({ data: fila });
        }
      }
      const quitados = actuales.filter((bloque) => !conservados.has(bloque.id)).map((bloque) => bloque.id);
      if (quitados.length) await tx.horarioAdministrativo.updateMany({ where: { id: { in: quitados } }, data: { activo: false } });
      await registrarAuditoria({ userId: user.id, accion, tabla: TABLA_AUDITORIA, registroId: grupoId, ip, datos: { ...data, desactivados: quitados.length } }, tx);
      return tx.horarioAdministrativo.findMany({ where: { grupo_id: grupoId, activo: true }, include: includeHorario, orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }] });
    });
  }

  /**
   * Una jornada no puede cruzarse con las clases del docente ni con otra
   * jornada que rija los mismos días: dos regulares, o dos temporales con
   * fechas superpuestas (eso último no se permite). Una temporal y la regular
   * no se cruzan, porque la temporal la reemplaza en sus fechas.
   */
  private async assertJornadaSinCruces(tx: DbClient, data: JornadaAdministrativaInput, grupoId: string, vigencia: { temporal: boolean; fecha_inicio: Date; fecha_fin: Date }) {
    const [clases, otros] = await Promise.all([
      tx.horario.findMany({
        where: { docente_id: data.docente_id, periodo_academico_id: data.periodo_academico_id, activo: true, fecha_inicio_ciclo: { lte: vigencia.fecha_fin }, fecha_fin_ciclo: { gte: vigencia.fecha_inicio } },
        select: { dia_semana: true, hora_inicio: true, hora_fin: true, materia: { select: { nombre: true } } },
      }),
      tx.horarioAdministrativo.findMany({
        where: { docente_id: data.docente_id, activo: true, grupo_id: { not: grupoId }, temporal: vigencia.temporal, fecha_inicio: { lte: vigencia.fecha_fin }, fecha_fin: { gte: vigencia.fecha_inicio } },
        select: { dia_semana: true, hora_inicio: true, hora_fin: true, fecha_inicio: true, fecha_fin: true },
      }),
    ]);
    if (vigencia.temporal && otros.length) {
      throw new AppError(`El docente ya tiene una jornada temporal del ${formatFecha(otros[0].fecha_inicio)} al ${formatFecha(otros[0].fecha_fin)}; las fechas no pueden superponerse.`, 409);
    }
    for (const bloque of data.bloques) {
      const etiqueta = `${DIA_LABEL[bloque.dia_semana]} ${bloque.hora_inicio}-${bloque.hora_fin}`;
      const clase = clases.find((item) => item.dia_semana === bloque.dia_semana && overlaps(bloque.hora_inicio, bloque.hora_fin, item.hora_inicio, item.hora_fin));
      if (clase) throw new AppError(`El bloque del ${etiqueta} se cruza con la clase de ${clase.materia.nombre} (${clase.hora_inicio}-${clase.hora_fin}).`, 409);
      const otro = otros.find((item) => item.dia_semana === bloque.dia_semana && overlaps(bloque.hora_inicio, bloque.hora_fin, item.hora_inicio, item.hora_fin));
      if (otro) throw new AppError(`El bloque del ${etiqueta} se cruza con otra jornada administrativa del docente (${otro.hora_inicio}-${otro.hora_fin}).`, 409);
    }
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
