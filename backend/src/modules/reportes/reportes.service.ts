import { Prisma, Rol } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import type { ReporteQueryInput } from './reportes.schemas';
import {
  buildAttendanceSummary,
  type AttendanceMark,
  type DaySummary,
  type GroupSummary,
  type ScheduleSlot,
} from './reportes.sessions';

interface AuthScope {
  id: string;
  rol: string;
}

interface ReportRow {
  id: string;
  docente: string;
  email: string;
  carrera: string;
  materia: string;
  ciclo: string;
  periodo_academico: string;
  paralelo: string;
  dia: string;
  horario: string;
  entrada: string;
  salida: string;
  estado: string;
  justificacion: string;
  ip_entrada: string;
  foto_entrada_url: string;
  foto_salida_url: string;
  lat: number | null;
  lng: number | null;
  precision_m: number | null;
  lat_entrada: number | null;
  lng_entrada: number | null;
  precision_entrada_m: number | null;
  lat_salida: number | null;
  lng_salida: number | null;
  precision_salida_m: number | null;
}

interface ReportSummaryData {
  tipo: 'docente' | 'administrativa';
  periodo: {
    fecha_inicio: string;
    fecha_fin: string;
  };
  totalProgramadas: number;
  totalRegistros: number;
  presentes: number;
  puntual: number;
  tardanza: number;
  justificado: number;
  ausente: number;
  registros: ReportRow[];
  porCarrera: GroupSummary[];
  porPeriodo: DaySummary[];
}

type RegistroAdministrativo = Awaited<ReturnType<typeof fetchRegistrosAdministrativos>>[number];

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
      periodo_academico: true,
      materia: {
        include: {
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

const administrativaInclude = {
  docente: { select: { id: true, nombre: true, apellido: true, email: true } },
  horario_administrativo: { include: { periodo_academico: true } },
} satisfies Prisma.RegistroAdministrativoInclude;

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

function ecuadorDateOnly(date: Date): Date {
  const isoDate = date.toISOString().slice(0, 10);
  return new Date(`${isoDate}T00:00:00-05:00`);
}

function defaultRange(filters: ReporteQueryInput): { from: Date; to: Date } {
  const today = new Date();
  return {
    from: filters.fecha_inicio ? ecuadorDateOnly(filters.fecha_inicio) : startOfDay(today),
    to: filters.fecha_fin ? endOfDay(ecuadorDateOnly(filters.fecha_fin)) : endOfDay(today),
  };
}

async function resolveRange(filters: ReporteQueryInput): Promise<{ from: Date; to: Date }> {
  if (!filters.periodo_academico_id || filters.fecha_inicio || filters.fecha_fin) {
    return defaultRange(filters);
  }

  const periodo = await prisma.periodoAcademico.findUnique({
    where: { id: filters.periodo_academico_id },
    select: { fecha_inicio: true, fecha_fin: true },
  });

  if (!periodo) return defaultRange(filters);

  // fecha_inicio/fecha_fin son @db.Date (medianoche UTC): se interpretan como días de Ecuador.
  const periodoFin = endOfDay(ecuadorDateOnly(periodo.fecha_fin));
  const hoy = endOfDay(new Date());
  return {
    from: ecuadorDateOnly(periodo.fecha_inicio),
    to: periodoFin < hoy ? periodoFin : hoy,
  };
}

function roleWhere(user: AuthScope): Prisma.RegistroAsistenciaWhereInput {
  if (user.rol === Rol.docente) {
    return { docente_id: user.id };
  }

  if (user.rol === Rol.coordinador) {
    return { horario: { materia: { carrera: { coordinador_id: user.id } } } };
  }

  return {};
}

function roleHorarioWhere(user: AuthScope): Prisma.HorarioWhereInput {
  if (user.rol === Rol.docente) {
    return { docente_id: user.id };
  }

  if (user.rol === Rol.coordinador) {
    return { materia: { carrera: { coordinador_id: user.id } } };
  }

  return {};
}

function scopedFilters(filters: ReporteQueryInput, user: AuthScope): ReporteQueryInput {
  if (user.rol === Rol.docente) {
    return {
      ...filters,
      docente_id: user.id,
    };
  }

  return filters;
}

function filterWhere(filters: ReporteQueryInput, from: Date, to: Date): Prisma.RegistroAsistenciaWhereInput {
  const periodoFilter = filters.periodo_academico_id
    ? {
        OR: [
          { periodo_academico_id: filters.periodo_academico_id },
          {
            periodo_academico_id: null,
            fecha_inicio_ciclo: { lte: to },
            fecha_fin_ciclo: { gte: from },
          },
        ],
      }
    : {};

  return {
    docente_id: filters.docente_id,
    estado: filters.estado,
    // Las justificaciones sin marcación no tienen hora de entrada: se ubican por fecha de creación.
    OR: [
      { timestamp_entrada: { gte: from, lte: to } },
      { timestamp_entrada: null, created_at: { gte: from, lte: to } },
    ],
    horario: {
      ...periodoFilter,
      materia_id: filters.materia_id,
      materia: {
        carrera_id: filters.carrera_id,
        ciclo: filters.ciclo,
      },
    },
  };
}

function filterHorarioWhere(filters: ReporteQueryInput, from: Date, to: Date): Prisma.HorarioWhereInput {
  const periodoFilter = filters.periodo_academico_id
    ? {
        OR: [
          { periodo_academico_id: filters.periodo_academico_id },
          { periodo_academico_id: null },
        ],
      }
    : {};

  return {
    ...periodoFilter,
    activo: true,
    fecha_inicio_ciclo: { lte: to },
    fecha_fin_ciclo: { gte: from },
    docente_id: filters.docente_id,
    materia: {
      id: filters.materia_id,
      carrera_id: filters.carrera_id,
      ciclo: filters.ciclo,
    },
  };
}

function formatDateTime(date: Date | null): string {
  if (!date) return '';

  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatLocation(row: ReportRow): string {
  if (row.lat === null || row.lng === null) {
    return 'Sin GPS';
  }

  const precision = row.precision_m ? ` / ${row.precision_m} m` : '';
  return `${row.lat.toFixed(6)}, ${row.lng.toFixed(6)}${precision}`;
}

function googleMapsUrl(row: ReportRow): string | null {
  if (row.lat === null || row.lng === null) {
    return null;
  }

  return `https://www.google.com/maps?q=${row.lat},${row.lng}`;
}

function drawPdfFooter(document: PDFKit.PDFDocument): void {
  const bottom = document.page.height - 34;
  document
    .save()
    .moveTo(40, bottom - 8)
    .lineTo(document.page.width - 40, bottom - 8)
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .stroke()
    .fillColor('#64748b')
    .fontSize(8)
    .text('Sistema de Asistencia Virtual Docente - ISTL', 40, bottom, {
      width: document.page.width - 80,
      align: 'left',
    })
    .text(`Página ${document.bufferedPageRange().count}`, 40, bottom, {
      width: document.page.width - 80,
      align: 'right',
    })
    .restore();
}

function addPdfPage(document: PDFKit.PDFDocument): void {
  drawPdfFooter(document);
  document.addPage();
}

function drawPdfHeader(document: PDFKit.PDFDocument, data: ReportSummaryData): void {
  document
    .fillColor('#0b3358')
    .fontSize(18)
    .text('Instituto Superior Tecnológico Loja', 40, 38, { width: 360 });
  document
    .fillColor('#0f766e')
    .fontSize(10)
    .text('Sistema de Asistencia Virtual Docente', 40, 62, { width: 360 });

  document
    .fillColor('#111827')
    .fontSize(11)
    .text(data.tipo === 'administrativa' ? 'Reporte de Jornada Administrativa' : 'Reporte de Asistencia Docente', 360, 40, {
      width: 195,
      align: 'right',
    });
  document
    .fillColor('#64748b')
    .fontSize(8)
    .text(`Generado: ${formatDateTime(new Date())}`, 360, 58, {
      width: 195,
      align: 'right',
    });

  document
    .moveTo(40, 86)
    .lineTo(document.page.width - 40, 86)
    .strokeColor('#0b3358')
    .lineWidth(1.4)
    .stroke();

  document
    .fillColor('#475569')
    .fontSize(9)
    .text(
      `Periodo: ${formatDateTime(new Date(data.periodo.fecha_inicio))} - ${formatDateTime(new Date(data.periodo.fecha_fin))}`,
      40,
      98,
      { width: document.page.width - 80 }
    );
}

function drawSummaryCards(document: PDFKit.PDFDocument, data: ReportSummaryData): void {
  const cards = [
    ['Programadas', data.totalProgramadas],
    ['Registros', data.totalRegistros],
    ['Presentes', data.presentes],
    ['Puntuales', data.puntual],
    ['Tardanzas', data.tardanza],
    ['Ausentes', data.ausente],
    ['Justificados', data.justificado],
  ];
  const startX = 40;
  const startY = 126;
  const gap = 8;
  const width = 68;
  const height = 44;

  cards.forEach(([label, value], index) => {
    const x = startX + index * (width + gap);
    document
      .roundedRect(x, startY, width, height, 4)
      .fillAndStroke('#f8fafc', '#dbe5ef')
      .fillColor('#0b3358')
      .fontSize(14)
      .text(String(value), x + 8, startY + 8, { width: width - 16, align: 'center' })
      .fillColor('#64748b')
      .fontSize(7)
      .text(String(label), x + 5, startY + 28, { width: width - 10, align: 'center' });
  });
}

function drawTableHeader(document: PDFKit.PDFDocument, y: number): void {
  document
    .rect(40, y, document.page.width - 80, 20)
    .fill('#0b3358')
    .fillColor('#ffffff')
    .fontSize(7.5)
    .text('Docente', 46, y + 6, { width: 100 })
    .text('Materia', 148, y + 6, { width: 102 })
    .text('Horario', 252, y + 6, { width: 70 })
    .text('Entrada', 324, y + 6, { width: 70 })
    .text('Salida', 396, y + 6, { width: 58 })
    .text('Estado', 456, y + 6, { width: 48 })
    .text('GPS', 506, y + 6, { width: 48 });
}

function drawReportRow(document: PDFKit.PDFDocument, row: ReportRow, y: number, shaded: boolean): number {
  const rowHeight = 38;
  const background = shaded ? '#f8fafc' : '#ffffff';
  const mapUrl = googleMapsUrl(row);

  document.rect(40, y, document.page.width - 80, rowHeight).fillAndStroke(background, '#e2e8f0');
  document
    .fillColor('#111827')
    .fontSize(7.2)
    .text(row.docente, 46, y + 6, { width: 98, height: 24 })
    .text(`${row.materia} (${row.paralelo})`, 148, y + 6, { width: 100, height: 24 })
    .text(row.horario, 252, y + 6, { width: 68 })
    .text(row.entrada || '-', 324, y + 6, { width: 70 })
    .text(row.salida || '-', 396, y + 6, { width: 58 })
    .text(row.estado, 456, y + 6, { width: 48 })
    .text(formatLocation(row), 506, y + 6, { width: 48, height: 18 });

  if (mapUrl) {
    document
      .fillColor('#0f766e')
      .fontSize(7)
      .text('Mapa', 506, y + 24, { width: 48, link: mapUrl, underline: true });
  }

  return y + rowHeight;
}

function toRows(registros: Awaited<ReturnType<typeof fetchRegistros>>): ReportRow[] {
  return registros.map((registro) => ({
    id: registro.id,
    docente: `${registro.docente.nombre} ${registro.docente.apellido}`,
    email: registro.docente.email,
    carrera: registro.horario.materia.carrera.nombre,
    materia: registro.horario.materia.nombre,
    ciclo: String(registro.horario.materia.ciclo),
    periodo_academico: registro.horario.periodo_academico?.nombre ?? registro.horario.ciclo,
    paralelo: registro.horario.asignacion_docente?.paralelo ?? 'A',
    dia: registro.horario.dia_semana,
    horario: `${registro.horario.hora_inicio} - ${registro.horario.hora_fin}`,
    entrada: formatDateTime(registro.timestamp_entrada),
    salida: formatDateTime(registro.timestamp_salida),
    estado: registro.estado,
    justificacion: registro.justificacion ?? '',
    ip_entrada: registro.ip_entrada ?? '',
    foto_entrada_url: registro.foto_entrada_url ?? '',
    foto_salida_url: registro.foto_salida_url ?? '',
    lat: registro.lat ? Number(registro.lat) : null,
    lng: registro.lng ? Number(registro.lng) : null,
    precision_m: registro.precision_m,
    lat_entrada: registro.lat_entrada ? Number(registro.lat_entrada) : registro.lat ? Number(registro.lat) : null,
    lng_entrada: registro.lng_entrada ? Number(registro.lng_entrada) : registro.lng ? Number(registro.lng) : null,
    precision_entrada_m: registro.precision_entrada_m ?? registro.precision_m,
    lat_salida: registro.lat_salida ? Number(registro.lat_salida) : null,
    lng_salida: registro.lng_salida ? Number(registro.lng_salida) : null,
    precision_salida_m: registro.precision_salida_m,
  }));
}

async function fetchRegistros(where: Prisma.RegistroAsistenciaWhereInput) {
  return prisma.registroAsistencia.findMany({
    where,
    include: asistenciaInclude,
    orderBy: [{ timestamp_entrada: 'desc' }, { created_at: 'desc' }],
  });
}

async function fetchHorariosProgramados(where: Prisma.HorarioWhereInput) {
  return prisma.horario.findMany({
    where,
    select: {
      id: true,
      dia_semana: true,
      hora_inicio: true,
      fecha_inicio_ciclo: true,
      fecha_fin_ciclo: true,
      periodo_academico: {
        select: {
          nombre: true,
          codigo: true,
        },
      },
      materia: {
        select: {
          carrera: {
            select: {
              nombre: true,
              codigo: true,
            },
          },
        },
      },
    },
  });
}

async function fetchRegistrosAdministrativos(where: Prisma.RegistroAdministrativoWhereInput) {
  return prisma.registroAdministrativo.findMany({
    where,
    include: administrativaInclude,
    orderBy: [{ timestamp_entrada: 'desc' }, { created_at: 'desc' }],
  });
}

async function fetchHorariosAdministrativos(where: Prisma.HorarioAdministrativoWhereInput) {
  return prisma.horarioAdministrativo.findMany({ where, include: { periodo_academico: true } });
}

function toAdministrativeRows(registros: RegistroAdministrativo[]): ReportRow[] {
  return registros.map((registro) => ({
    id: registro.id,
    docente: `${registro.docente.nombre} ${registro.docente.apellido}`,
    email: registro.docente.email,
    carrera: 'Administrativa',
    materia: registro.horario_administrativo.descripcion || 'Actividad administrativa',
    ciclo: '-',
    periodo_academico: registro.horario_administrativo.periodo_academico.nombre,
    paralelo: '-',
    dia: registro.horario_administrativo.dia_semana,
    horario: `${registro.horario_administrativo.hora_inicio} - ${registro.horario_administrativo.hora_fin}`,
    entrada: formatDateTime(registro.timestamp_entrada),
    salida: formatDateTime(registro.timestamp_salida),
    estado: registro.estado,
    justificacion: registro.justificacion ?? '',
    ip_entrada: registro.ip_entrada ?? '',
    foto_entrada_url: registro.foto_entrada_url ?? '',
    foto_salida_url: registro.foto_salida_url ?? '',
    lat: registro.lat_entrada ? Number(registro.lat_entrada) : null,
    lng: registro.lng_entrada ? Number(registro.lng_entrada) : null,
    precision_m: registro.precision_entrada_m,
    lat_entrada: registro.lat_entrada ? Number(registro.lat_entrada) : null,
    lng_entrada: registro.lng_entrada ? Number(registro.lng_entrada) : null,
    precision_entrada_m: registro.precision_entrada_m,
    lat_salida: registro.lat_salida ? Number(registro.lat_salida) : null,
    lng_salida: registro.lng_salida ? Number(registro.lng_salida) : null,
    precision_salida_m: registro.precision_salida_m,
  }));
}

export class ReportesService {
  async resumen(filters: ReporteQueryInput, user: AuthScope) {
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

    return this.toSummaryData('docente', from, to, buildAttendanceSummary({ from, to, now: new Date(), slots, marks }), toRows(registros));
  }

  private async resumenAdministrativa(filters: ReporteQueryInput, user: AuthScope): Promise<ReportSummaryData> {
    if (user.rol !== Rol.docente && user.rol !== Rol.talento_humano) {
      throw new AppError('Solo Talento Humano y el docente pueden consultar reportes administrativos.', 403);
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

    const grupo = { nombre: 'Jornada administrativa', codigo: 'ADM' };
    const slots: ScheduleSlot[] = horarios.map((horario) => ({
      id: horario.id,
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      fecha_inicio: horario.fecha_inicio,
      fecha_fin: horario.fecha_fin,
      grupo,
    }));
    const marks: AttendanceMark[] = registros.map((registro) => ({
      slotId: registro.horario_administrativo_id,
      grupo,
      estado: registro.estado,
      timestamp_entrada: registro.timestamp_entrada,
      created_at: registro.created_at,
    }));
    const summary = buildAttendanceSummary({ from, to, now: new Date(), slots, marks });
    if (summary.porGrupo.length === 0) {
      summary.porGrupo.push({ carrera: grupo.nombre, codigo: grupo.codigo, ...summary.totals });
    }

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

  async excel(filters: ReporteQueryInput, user: AuthScope): Promise<Buffer> {
    const data = await this.resumen(filters, user);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ISTL';
    workbook.created = new Date();

    const resumenSheet = workbook.addWorksheet('Resumen');
    resumenSheet.columns = [
      { header: 'Indicador', key: 'indicador', width: 28 },
      { header: 'Valor', key: 'valor', width: 16 },
    ];
    resumenSheet.addRows([
      { indicador: 'Clases programadas', valor: data.totalProgramadas },
      { indicador: 'Registros', valor: data.totalRegistros },
      { indicador: 'Presentes', valor: data.presentes },
      { indicador: 'Puntuales', valor: data.puntual },
      { indicador: 'Tardanzas', valor: data.tardanza },
      { indicador: 'Ausentes', valor: data.ausente },
      { indicador: 'Justificados', valor: data.justificado },
    ]);

    const registrosSheet = workbook.addWorksheet('Registros');
    registrosSheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Docente', key: 'docente', width: 28 },
      { header: 'Email', key: 'email', width: 34 },
      { header: 'Carrera', key: 'carrera', width: 24 },
      { header: 'Materia', key: 'materia', width: 32 },
      { header: 'Ciclo', key: 'ciclo', width: 14 },
      { header: 'Período académico', key: 'periodo_academico', width: 26 },
      { header: 'Día', key: 'dia', width: 14 },
      { header: 'Horario', key: 'horario', width: 16 },
      { header: 'Entrada', key: 'entrada', width: 20 },
      { header: 'Salida', key: 'salida', width: 20 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Justificación', key: 'justificacion', width: 36 },
      { header: 'IP entrada', key: 'ip_entrada', width: 18 },
      { header: 'Foto entrada', key: 'foto_entrada_url', width: 34 },
      { header: 'Foto salida', key: 'foto_salida_url', width: 34 },
      { header: 'Latitud entrada', key: 'lat_entrada', width: 16 },
      { header: 'Longitud entrada', key: 'lng_entrada', width: 16 },
      { header: 'Precisión entrada m', key: 'precision_entrada_m', width: 18 },
      { header: 'Latitud salida', key: 'lat_salida', width: 16 },
      { header: 'Longitud salida', key: 'lng_salida', width: 16 },
      { header: 'Precisión salida m', key: 'precision_salida_m', width: 18 },
    ];
    registrosSheet.addRows(data.registros);

    [resumenSheet, registrosSheet].forEach((sheet) => {
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0B3358' },
      };
      sheet.getRow(1).alignment = { vertical: 'middle' };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async pdf(filters: ReporteQueryInput, user: AuthScope): Promise<Buffer> {
    const data = await this.resumen(filters, user);
    const document = new PDFDocument({ autoFirstPage: false, bufferPages: true, margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    document.on('data', (chunk: Buffer) => chunks.push(chunk));

    document.addPage();
    drawPdfHeader(document, data);
    drawSummaryCards(document, data);
    document.fillColor('#0b3358').fontSize(12).text('Detalle de marcaciones', 40, 194);

    let y = 216;
    drawTableHeader(document, y);
    y += 20;

    if (data.registros.length === 0) {
      document
        .fillColor('#64748b')
        .fontSize(10)
        .text('No existen registros para los filtros seleccionados.', 40, y + 12, {
          width: document.page.width - 80,
        });
    } else {
      data.registros.forEach((row, index) => {
        if (y > document.page.height - 84) {
          addPdfPage(document);
          drawPdfHeader(document, data);
          document.fillColor('#0b3358').fontSize(12).text('Detalle de marcaciones', 40, 126);
          y = 148;
          drawTableHeader(document, y);
          y += 20;
        }

        y = drawReportRow(document, row, y, index % 2 === 0);
      });
    }

    drawPdfFooter(document);
    document.end();

    return new Promise((resolve) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}

export const reportesService = new ReportesService();
