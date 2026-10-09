import { Rol } from '@prisma/client';
import { AppError } from '../../shared/middleware/errorHandler';
import { currentTime } from '../../shared/attendance/clock';
import { PHOTO_URL_EXPORT_TTL_SECONDS, PHOTO_URL_TTL_SECONDS, withSignedPhotos } from '../../shared/attendance/photoUrls';
import { renderReportExcel } from './reportes.excel';
import { renderReportPdf } from './reportes.pdf';
import {
  fetchHorariosAdministrativos,
  fetchHorariosProgramados,
  fetchRegistros,
  fetchRegistrosAdministrativos,
  filterHorarioWhere,
  filterWhere,
  resolveRange,
  roleHorarioWhere,
  roleWhere,
  scopedFilters,
  toAdministrativeRows,
  toRows,
} from './reportes.query';
import type { ReporteQueryInput } from './reportes.schemas';
import { buildAttendanceSummary, type AttendanceMark, type ScheduleSlot } from './reportes.sessions';
import type { ReportRow, ReportScope as AuthScope, ReportSummaryData } from './reportes.types';

const ROLES_REPORTE_ADMINISTRATIVO: Rol[] = [Rol.docente, Rol.talento_humano, Rol.tics, Rol.rectorado];

/**
 * Grupo de un docente para los gráficos: nombre completo y, como etiqueta
 * corta y única, el usuario de su correo institucional (ana.perez@... -> ana.perez).
 */
function grupoDocente(docente: { nombre: string; apellido: string; email: string }) {
  return { nombre: `${docente.nombre} ${docente.apellido}`, codigo: docente.email.split('@')[0] };
}

export class ReportesService {
  /** Resumen para la pantalla, con enlaces de foto firmados por pocas horas. */
  async resumen(filters: ReporteQueryInput, user: AuthScope): Promise<ReportSummaryData> {
    return withSignedPhotos(await this.calcular(filters, user), PHOTO_URL_TTL_SECONDS);
  }

  private async calcular(filters: ReporteQueryInput, user: AuthScope): Promise<ReportSummaryData> {
    if (filters.tipo === 'administrativa') {
      return this.resumenAdministrativa(filters, user);
    }
    return this.resumenDocente(filters, user);
  }

  private async resumenDocente(filters: ReporteQueryInput, user: AuthScope): Promise<ReportSummaryData> {
    const scoped = scopedFilters(filters, user);
    const { from, to } = await resolveRange(scoped);
    const [registros, horariosProgramados] = await Promise.all([
      fetchRegistros({ AND: [roleWhere(user), filterWhere(scoped, from, to)] }),
      fetchHorariosProgramados({ AND: [roleHorarioWhere(user), filterHorarioWhere(scoped, from, to)] }),
    ]);

    const slots: ScheduleSlot[] = horariosProgramados.map((horario) => ({
      id: horario.id,
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      fecha_inicio: horario.fecha_inicio_ciclo,
      fecha_fin: horario.fecha_fin_ciclo,
      grupo: horario.materia.carrera,
    }));
    const marks: AttendanceMark[] = registros.map((registro) => ({
      slotId: registro.horario_id,
      grupo: registro.horario.materia.carrera,
      estado: registro.estado,
      timestamp_entrada: registro.timestamp_entrada,
      created_at: registro.created_at,
    }));

    return this.toSummaryData('docente', from, to, buildAttendanceSummary({ from, to, now: currentTime(), slots, marks }), toRows(registros));
  }

  private async resumenAdministrativa(filters: ReporteQueryInput, user: AuthScope): Promise<ReportSummaryData> {
    // El docente ve solo lo suyo (scopedFilters); las autoridades, a toda la institución.
    // Coordinación no: las horas administrativas no dependen de una carrera.
    if (!ROLES_REPORTE_ADMINISTRATIVO.includes(user.rol as Rol)) {
      throw new AppError('Solo Talento Humano, TICs, Rectorado y el docente pueden consultar reportes administrativos.', 403);
    }
    const scoped = scopedFilters(filters, user);
    const { from, to } = await resolveRange(scoped);
    const [registros, horarios] = await Promise.all([
      fetchRegistrosAdministrativos({
        docente_id: scoped.docente_id,
        estado: scoped.estado,
        timestamp_entrada: { gte: from, lte: to },
        horario_administrativo: scoped.periodo_academico_id ? { periodo_academico_id: scoped.periodo_academico_id } : undefined,
      }),
      fetchHorariosAdministrativos({
        activo: true,
        docente_id: scoped.docente_id,
        periodo_academico_id: scoped.periodo_academico_id,
        fecha_inicio: { lte: to },
        fecha_fin: { gte: from },
      }),
    ]);

    // En la jornada administrativa el desglose natural es por docente (en clases, por carrera).
    const slots: ScheduleSlot[] = horarios.map((horario) => ({
      id: horario.id,
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      fecha_inicio: horario.fecha_inicio,
      fecha_fin: horario.fecha_fin,
      grupo: grupoDocente(horario.docente),
    }));
    const marks: AttendanceMark[] = registros.map((registro) => ({
      slotId: registro.horario_administrativo_id,
      grupo: grupoDocente(registro.docente),
      estado: registro.estado,
      timestamp_entrada: registro.timestamp_entrada,
      created_at: registro.created_at,
    }));
    const summary = buildAttendanceSummary({ from, to, now: currentTime(), slots, marks });

    return this.toSummaryData('administrativa', from, to, summary, toAdministrativeRows(registros));
  }

  private toSummaryData(
    tipo: ReportSummaryData['tipo'],
    from: Date,
    to: Date,
    summary: ReturnType<typeof buildAttendanceSummary>,
    registros: ReportRow[]
  ): ReportSummaryData {
    return {
      tipo,
      periodo: { fecha_inicio: from.toISOString(), fecha_fin: to.toISOString() },
      totalProgramadas: summary.totals.programadas,
      totalRegistros: summary.totals.registros,
      presentes: summary.totals.presentes,
      puntual: summary.totals.puntual,
      tardanza: summary.totals.tardanza,
      justificado: summary.totals.justificado,
      ausente: summary.totals.ausente,
      registros,
      porCarrera: summary.porGrupo,
      porPeriodo: summary.porDia,
    };
  }

  /**
   * Excel con enlaces de foto absolutos (el archivo se abre fuera del sistema)
   * firmados por varios días. `publicBaseUrl` es la dirección pública del backend.
   */
  async excel(filters: ReporteQueryInput, user: AuthScope, publicBaseUrl: string): Promise<Buffer> {
    const data = await this.calcular(filters, user);
    return renderReportExcel(withSignedPhotos(data, PHOTO_URL_EXPORT_TTL_SECONDS, Date.now(), publicBaseUrl));
  }

  async pdf(filters: ReporteQueryInput, user: AuthScope): Promise<Buffer> {
    return renderReportPdf(await this.calcular(filters, user));
  }
}

export const reportesService = new ReportesService();
