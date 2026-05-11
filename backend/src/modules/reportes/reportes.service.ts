import { DiaSemana, EstadoAsistencia, Prisma, Rol } from '@prisma/client';
import PDFDocument from 'pdfkit';
import XLSX from 'xlsx';
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
  dia: string;
  horario: string;
  entrada: string;
  salida: string;
  estado: string;
  justificacion: string;
  ip_entrada: string;
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

function defaultRange(filters: ReporteQueryInput): { from: Date; to: Date } {
  const today = new Date();
  return {
    from: filters.fecha_inicio ? startOfDay(filters.fecha_inicio) : startOfDay(today),
    to: filters.fecha_fin ? endOfDay(filters.fecha_fin) : endOfDay(today),
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
    return { materia: { docente_id: user.id } };
  }

  if (user.rol === Rol.coordinador) {
    return { materia: { carrera: { coordinador_id: user.id } } };
  }

  return {};
}

function filterWhere(filters: ReporteQueryInput, from: Date, to: Date): Prisma.RegistroAsistenciaWhereInput {
  return {
    docente_id: filters.docente_id,
    estado: filters.estado,
    timestamp_entrada: {
      gte: from,
      lte: to,
    },
    horario: {
      ciclo: filters.ciclo,
      materia_id: filters.materia_id,
      materia: {
        carrera_id: filters.carrera_id,
      },
    },
  };
}

function filterHorarioWhere(filters: ReporteQueryInput, from: Date, to: Date): Prisma.HorarioWhereInput {
  return {
    ciclo: filters.ciclo,
    activo: true,
    fecha_inicio_ciclo: { lte: to },
    fecha_fin_ciclo: { gte: from },
    materia: {
      id: filters.materia_id,
      docente_id: filters.docente_id,
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

function countWeekdayBetween(from: Date, to: Date, dia: DiaSemana): number {
  const dayMap: Record<DiaSemana, number> = {
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
  };

  let count = 0;
  const cursor = startOfDay(from);
  const end = startOfDay(to);

  while (cursor <= end) {
    if (cursor.getDay() === dayMap[dia]) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function toRows(registros: Awaited<ReturnType<typeof fetchRegistros>>): ReportRow[] {
  return registros.map((registro) => ({
    id: registro.id,
    docente: `${registro.docente.nombre} ${registro.docente.apellido}`,
    email: registro.docente.email,
    carrera: registro.horario.materia.carrera.nombre,
    materia: registro.horario.materia.nombre,
    ciclo: registro.horario.ciclo,
    dia: registro.horario.dia_semana,
    horario: `${registro.horario.hora_inicio} - ${registro.horario.hora_fin}`,
    entrada: formatDateTime(registro.timestamp_entrada),
    salida: formatDateTime(registro.timestamp_salida),
    estado: registro.estado,
    justificacion: registro.justificacion ?? '',
    ip_entrada: registro.ip_entrada ?? '',
  }));
}

async function fetchRegistros(where: Prisma.RegistroAsistenciaWhereInput) {
  return prisma.registroAsistencia.findMany({
    where,
    include: asistenciaInclude,
    orderBy: [{ timestamp_entrada: 'desc' }, { created_at: 'desc' }],
  });
}

export class ReportesService {
  async resumen(filters: ReporteQueryInput, user: AuthScope) {
    const { from, to } = defaultRange(filters);
    const where: Prisma.RegistroAsistenciaWhereInput = {
      AND: [roleWhere(user), filterWhere(filters, from, to)],
    };

    const registros = await fetchRegistros(where);
    const horariosProgramados = await prisma.horario.findMany({
      where: {
        AND: [roleHorarioWhere(user), filterHorarioWhere(filters, from, to)],
      },
      select: {
        id: true,
        dia_semana: true,
      },
    });

    const totalProgramadas = horariosProgramados.reduce(
      (total, horario) => total + countWeekdayBetween(from, to, horario.dia_semana),
      0
    );

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

    const conEntrada = registros.filter((registro) => !!registro.timestamp_entrada).length;
    const ausenciasCalculadas = Math.max(totalProgramadas - conEntrada, 0);

    return {
      periodo: {
        fecha_inicio: from.toISOString(),
        fecha_fin: to.toISOString(),
      },
      totalProgramadas,
      totalRegistros: registros.length,
      presentes: conEntrada,
      puntual: byEstado.puntual,
      tardanza: byEstado.tardanza,
      justificado: byEstado.justificado,
      ausente: byEstado.ausente + ausenciasCalculadas,
      registros: toRows(registros),
    };
  }

  async excel(filters: ReporteQueryInput, user: AuthScope): Promise<Buffer> {
    const data = await this.resumen(filters, user);
    const workbook = XLSX.utils.book_new();
    const resumenSheet = XLSX.utils.json_to_sheet([
      { indicador: 'Clases programadas', valor: data.totalProgramadas },
      { indicador: 'Registros', valor: data.totalRegistros },
      { indicador: 'Presentes', valor: data.presentes },
      { indicador: 'Puntuales', valor: data.puntual },
      { indicador: 'Tardanzas', valor: data.tardanza },
      { indicador: 'Ausentes', valor: data.ausente },
      { indicador: 'Justificados', valor: data.justificado },
    ]);
    const registrosSheet = XLSX.utils.json_to_sheet(data.registros);

    XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen');
    XLSX.utils.book_append_sheet(workbook, registrosSheet, 'Registros');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async pdf(filters: ReporteQueryInput, user: AuthScope): Promise<Buffer> {
    const data = await this.resumen(filters, user);
    const document = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    document.on('data', (chunk: Buffer) => chunks.push(chunk));

    document.fillColor('#0b3358').fontSize(18).text('ISTL - Reporte de Asistencia Docente');
    document.moveDown(0.5);
    document.fillColor('#475569').fontSize(10).text(`Periodo: ${formatDateTime(new Date(data.periodo.fecha_inicio))} - ${formatDateTime(new Date(data.periodo.fecha_fin))}`);
    document.moveDown();

    document.fillColor('#0b3358').fontSize(13).text('Resumen');
    document.moveDown(0.5);
    [
      ['Clases programadas', data.totalProgramadas],
      ['Registros', data.totalRegistros],
      ['Presentes', data.presentes],
      ['Puntuales', data.puntual],
      ['Tardanzas', data.tardanza],
      ['Ausentes', data.ausente],
      ['Justificados', data.justificado],
    ].forEach(([label, value]) => {
      document.fillColor('#111827').fontSize(10).text(`${label}: ${value}`);
    });

    document.moveDown();
    document.fillColor('#0b3358').fontSize(13).text('Ultimos registros');
    document.moveDown(0.5);

    data.registros.slice(0, 25).forEach((row) => {
      document
        .fillColor('#111827')
        .fontSize(9)
        .text(`${row.entrada} | ${row.docente} | ${row.materia} | ${row.estado}`);
    });

    if (data.registros.length === 0) {
      document.fillColor('#64748b').fontSize(10).text('No existen registros para los filtros seleccionados.');
    }

    document.end();

    return new Promise((resolve) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}

export const reportesService = new ReportesService();
