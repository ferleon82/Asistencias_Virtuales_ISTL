import { Prisma, Rol } from '@prisma/client';
import { prisma } from '../../config/database';
import { currentTime, dateOnlyKey, ecuadorDayRange, ecuadorDayRangeOfKey } from '../../shared/attendance/clock';
import { formatDateTime } from './reportes.format';
import type { ReporteQueryInput } from './reportes.schemas';
import type { ReportRow, ReportScope } from './reportes.types';

// Consultas y mapeo de filas de los reportes. El cálculo de sesiones vive en
// reportes.sessions.ts y la exportación en reportes.pdf.ts / reportes.excel.ts.

type AuthScope = ReportScope;
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

export interface ReportRange {
  from: Date;
  to: Date;
}

/**
 * Rango del reporte en días de Ecuador. Las fechas de los filtros y de los
 * períodos llegan sin hora (medianoche UTC) y se toman como días completos.
 * Por defecto se reporta el día actual; con período académico, desde su inicio
 * hasta su fin o hasta hoy, lo que ocurra primero.
 */
export async function resolveRange(filters: ReporteQueryInput, now: Date = currentTime()): Promise<ReportRange> {
  const today = ecuadorDayRange(now);
  const explicit = filters.fecha_inicio || filters.fecha_fin;

  const periodo =
    filters.periodo_academico_id && !explicit
      ? await prisma.periodoAcademico.findUnique({
          where: { id: filters.periodo_academico_id },
          select: { fecha_inicio: true, fecha_fin: true },
        })
      : null;

  if (periodo) {
    const periodoFin = ecuadorDayRangeOfKey(dateOnlyKey(periodo.fecha_fin)).lte;
    return {
      from: ecuadorDayRangeOfKey(dateOnlyKey(periodo.fecha_inicio)).gte,
      to: periodoFin < today.lte ? periodoFin : today.lte,
    };
  }

  return {
    from: filters.fecha_inicio ? ecuadorDayRangeOfKey(dateOnlyKey(filters.fecha_inicio)).gte : today.gte,
    to: filters.fecha_fin ? ecuadorDayRangeOfKey(dateOnlyKey(filters.fecha_fin)).lte : today.lte,
  };
}

export function roleWhere(user: AuthScope): Prisma.RegistroAsistenciaWhereInput {
  if (user.rol === Rol.docente) {
    return { docente_id: user.id };
  }

  if (user.rol === Rol.coordinador) {
    return { horario: { materia: { carrera: { coordinador_id: user.id } } } };
  }

  return {};
}

export function roleHorarioWhere(user: AuthScope): Prisma.HorarioWhereInput {
  if (user.rol === Rol.docente) {
    return { docente_id: user.id };
  }

  if (user.rol === Rol.coordinador) {
    return { materia: { carrera: { coordinador_id: user.id } } };
  }

  return {};
}

export function scopedFilters(filters: ReporteQueryInput, user: AuthScope): ReporteQueryInput {
  if (user.rol === Rol.docente) {
    return {
      ...filters,
      docente_id: user.id,
    };
  }

  return filters;
}

export function filterWhere(filters: ReporteQueryInput, from: Date, to: Date): Prisma.RegistroAsistenciaWhereInput {
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

export function filterHorarioWhere(filters: ReporteQueryInput, from: Date, to: Date): Prisma.HorarioWhereInput {
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

export function toRows(registros: Awaited<ReturnType<typeof fetchRegistros>>): ReportRow[] {
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

export async function fetchRegistros(where: Prisma.RegistroAsistenciaWhereInput) {
  return prisma.registroAsistencia.findMany({
    where,
    include: asistenciaInclude,
    orderBy: [{ timestamp_entrada: 'desc' }, { created_at: 'desc' }],
  });
}

export async function fetchHorariosProgramados(where: Prisma.HorarioWhereInput) {
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

export async function fetchRegistrosAdministrativos(where: Prisma.RegistroAdministrativoWhereInput) {
  return prisma.registroAdministrativo.findMany({
    where,
    include: administrativaInclude,
    orderBy: [{ timestamp_entrada: 'desc' }, { created_at: 'desc' }],
  });
}

export async function fetchHorariosAdministrativos(where: Prisma.HorarioAdministrativoWhereInput) {
  return prisma.horarioAdministrativo.findMany({ where, include: { periodo_academico: true } });
}

export function toAdministrativeRows(registros: RegistroAdministrativo[]): ReportRow[] {
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
