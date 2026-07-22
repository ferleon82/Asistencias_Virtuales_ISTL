import { DiaSemana, EstadoAsistencia, Prisma, Rol } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../../config/database';
import type { ReporteQueryInput } from './reportes.schemas';

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
}

interface ReportSummaryData {
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
  porCarrera: ReportCareerSummary[];
  porPeriodo: ReportPeriodSummary[];
}

interface ReportCareerSummary {
  carrera: string;
  codigo: string;
  programadas: number;
  registros: number;
  presentes: number;
  puntual: number;
  tardanza: number;
  ausente: number;
  justificado: number;
}

interface ReportPeriodSummary {
  periodo: string;
  programadas: number;
  registros: number;
  presentes: number;
  puntual: number;
  tardanza: number;
  ausente: number;
  justificado: number;
}

type HorarioProgramado = Awaited<ReturnType<typeof fetchHorariosProgramados>>[number];
type RegistroAsistencia = Awaited<ReturnType<typeof fetchRegistros>>[number];

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

  return {
    from: startOfDay(periodo.fecha_inicio),
    to: endOfDay(new Date()),
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
    timestamp_entrada: {
      gte: from,
      lte: to,
    },
    horario: {
      ...periodoFilter,
      ciclo: filters.ciclo,
      materia_id: filters.materia_id,
      materia: {
        carrera_id: filters.carrera_id,
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
    ciclo: filters.ciclo,
    activo: true,
    fecha_inicio_ciclo: { lte: to },
    fecha_fin_ciclo: { gte: from },
    docente_id: filters.docente_id,
    materia: {
      id: filters.materia_id,
      carrera_id: filters.carrera_id,
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
    .text('Reporte de Asistencia Docente', 360, 40, {
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
    .text(row.materia, 148, y + 6, { width: 100, height: 24 })
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

function dateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfDay(from);
  const end = startOfDay(to);

  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function scheduledDatesForHorario(from: Date, to: Date, dia: DiaSemana): string[] {
  const dayMap: Record<DiaSemana, number> = {
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
  };

  return eachDay(from, to)
    .filter((day) => day.getDay() === dayMap[dia])
    .map(dateKey);
}

function sessionKey(horarioId: string, date: Date): string {
  return `${horarioId}:${dateKey(date)}`;
}

function emptyCareerSummary(carrera: string, codigo: string): ReportCareerSummary {
  return {
    carrera,
    codigo,
    programadas: 0,
    registros: 0,
    presentes: 0,
    puntual: 0,
    tardanza: 0,
    ausente: 0,
    justificado: 0,
  };
}

function emptyPeriodSummary(periodo: string): ReportPeriodSummary {
  return {
    periodo,
    programadas: 0,
    registros: 0,
    presentes: 0,
    puntual: 0,
    tardanza: 0,
    ausente: 0,
    justificado: 0,
  };
}

function toRows(registros: Awaited<ReturnType<typeof fetchRegistros>>): ReportRow[] {
  return registros.map((registro) => ({
    id: registro.id,
    docente: `${registro.docente.nombre} ${registro.docente.apellido}`,
    email: registro.docente.email,
    carrera: registro.horario.materia.carrera.nombre,
    materia: registro.horario.materia.nombre,
    ciclo: registro.horario.ciclo,
    periodo_academico: registro.horario.periodo_academico?.nombre ?? registro.horario.ciclo,
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

function addScheduledSession(
  scheduledSessions: Set<string>,
  horario: HorarioProgramado | RegistroAsistencia['horario'],
  date: Date,
  porCarreraMap: Map<string, ReportCareerSummary>,
  porPeriodoMap: Map<string, ReportPeriodSummary>
): void {
  const key = sessionKey(horario.id, date);
  if (scheduledSessions.has(key)) return;

  scheduledSessions.add(key);

  const carrera = horario.materia.carrera;
  const carreraKey = carrera.codigo;
  const carreraSummary = porCarreraMap.get(carreraKey) ?? emptyCareerSummary(carrera.nombre, carrera.codigo);
  carreraSummary.programadas += 1;
  porCarreraMap.set(carreraKey, carreraSummary);

  const periodKey = dateKey(date);
  const periodSummary = porPeriodoMap.get(periodKey) ?? emptyPeriodSummary(dateLabel(date));
  periodSummary.programadas += 1;
  porPeriodoMap.set(periodKey, periodSummary);
}

function addPresentSession(
  presentSessions: Set<string>,
  registro: RegistroAsistencia,
  porCarreraMap: Map<string, ReportCareerSummary>,
  porPeriodoMap: Map<string, ReportPeriodSummary>
): void {
  if (!registro.timestamp_entrada) return;

  const key = sessionKey(registro.horario.id, registro.timestamp_entrada);
  if (presentSessions.has(key)) return;

  presentSessions.add(key);

  const carrera = registro.horario.materia.carrera;
  const carreraKey = carrera.codigo;
  const carreraSummary = porCarreraMap.get(carreraKey) ?? emptyCareerSummary(carrera.nombre, carrera.codigo);
  carreraSummary.presentes += 1;
  porCarreraMap.set(carreraKey, carreraSummary);

  const periodKey = dateKey(registro.timestamp_entrada);
  const periodSummary = porPeriodoMap.get(periodKey) ?? emptyPeriodSummary(dateLabel(registro.timestamp_entrada));
  periodSummary.presentes += 1;
  porPeriodoMap.set(periodKey, periodSummary);
}

export class ReportesService {
  async resumen(filters: ReporteQueryInput, user: AuthScope) {
    const scoped = scopedFilters(filters, user);
    const { from, to } = await resolveRange(scoped);
    const where: Prisma.RegistroAsistenciaWhereInput = {
      AND: [roleWhere(user), filterWhere(scoped, from, to)],
    };

    const registros = await fetchRegistros(where);
    const horariosProgramados = await fetchHorariosProgramados({
      AND: [roleHorarioWhere(user), filterHorarioWhere(scoped, from, to)],
    });

    const byEstado = registros.reduce<Record<EstadoAsistencia, number>>(
      (acc, registro) => {
        acc[registro.estado] += 1;
        return acc;
      },
      {
        puntual: 0,
        tardanza: 0,
        ausente: 0,
        justificado: 0,
      }
    );

    const porCarreraMap = new Map<string, ReportCareerSummary>();
    const porPeriodoMap = new Map<string, ReportPeriodSummary>();
    const scheduledSessions = new Set<string>();
    const presentSessions = new Set<string>();

    eachDay(from, to).forEach((day) => {
      porPeriodoMap.set(dateKey(day), emptyPeriodSummary(dateLabel(day)));
    });

    horariosProgramados.forEach((horario) => {
      scheduledDatesForHorario(from, to, horario.dia_semana).forEach((scheduledDate) => {
        addScheduledSession(scheduledSessions, horario, new Date(`${scheduledDate}T00:00:00-05:00`), porCarreraMap, porPeriodoMap);
      });
    });

    registros.forEach((registro) => {
      if (registro.timestamp_entrada) {
        addScheduledSession(scheduledSessions, registro.horario, registro.timestamp_entrada, porCarreraMap, porPeriodoMap);
        addPresentSession(presentSessions, registro, porCarreraMap, porPeriodoMap);
      }

      const carrera = registro.horario.materia.carrera;
      const carreraKey = carrera.codigo;
      const carreraSummary =
        porCarreraMap.get(carreraKey) ?? emptyCareerSummary(carrera.nombre, carrera.codigo);
      carreraSummary.registros += 1;
      carreraSummary[registro.estado] += 1;
      porCarreraMap.set(carreraKey, carreraSummary);

      if (registro.timestamp_entrada) {
        const periodKey = dateKey(registro.timestamp_entrada);
        const periodSummary = porPeriodoMap.get(periodKey) ?? emptyPeriodSummary(dateLabel(registro.timestamp_entrada));
        periodSummary.registros += 1;
        periodSummary[registro.estado] += 1;
        porPeriodoMap.set(periodKey, periodSummary);
      }
    });

    porCarreraMap.forEach((summary) => {
      summary.ausente += Math.max(summary.programadas - summary.presentes, 0);
    });

    porPeriodoMap.forEach((summary) => {
      summary.ausente += Math.max(summary.programadas - summary.presentes, 0);
    });

    return {
      periodo: {
        fecha_inicio: from.toISOString(),
        fecha_fin: to.toISOString(),
      },
      totalProgramadas: scheduledSessions.size,
      totalRegistros: registros.length,
      presentes: presentSessions.size,
      puntual: byEstado.puntual,
      tardanza: byEstado.tardanza,
      justificado: byEstado.justificado,
      ausente: byEstado.ausente + Math.max(scheduledSessions.size - presentSessions.size, 0),
      registros: toRows(registros),
      porCarrera: Array.from(porCarreraMap.values()).sort((a, b) => a.carrera.localeCompare(b.carrera)),
      porPeriodo: Array.from(porPeriodoMap.values()),
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
      { header: 'Latitud', key: 'lat', width: 14 },
      { header: 'Longitud', key: 'lng', width: 14 },
      { header: 'Precisión m', key: 'precision_m', width: 14 },
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
