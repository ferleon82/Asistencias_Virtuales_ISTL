import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { dateOnlyKey, ecuadorDbDate } from './clock';
import type { DbClient } from './lock';

// Calendario institucional de días no laborables. Es la única fuente que
// consultan la marcación (clases y jornada administrativa) y los reportes.

export interface DiaNoLaborableInfo {
  /** Fecha YYYY-MM-DD. */
  fecha: string;
  descripcion: string;
}

/** Día no laborable del día de Ecuador que contiene `now`, o `null`. */
export async function getDiaNoLaborable(now: Date, db: DbClient = prisma): Promise<DiaNoLaborableInfo | null> {
  const dia = await sinCalendarioSiFaltaTabla(
    () => db.diaNoLaborable.findUnique({ where: { fecha: ecuadorDbDate(now) }, select: { fecha: true, descripcion: true } }),
    null
  );
  return dia ? { fecha: dateOnlyKey(dia.fecha), descripcion: dia.descripcion } : null;
}

/** Fechas YYYY-MM-DD no laborables entre dos instantes (días de Ecuador, inclusive). */
export async function getFechasNoLaborables(from: Date, to: Date): Promise<Set<string>> {
  const dias = await sinCalendarioSiFaltaTabla(
    () =>
      prisma.diaNoLaborable.findMany({
        where: { fecha: { gte: ecuadorDbDate(from), lte: ecuadorDbDate(to) } },
        select: { fecha: true },
      }),
    []
  );
  return new Set(dias.map((dia) => dateOnlyKey(dia.fecha)));
}

let avisoTablaFaltante = false;

/**
 * Si la migración del calendario aún no se aplicó (tabla inexistente, P2021),
 * se asume que no hay feriados en lugar de bloquear la marcación de todos.
 */
async function sinCalendarioSiFaltaTabla<T>(consulta: () => Promise<T>, vacio: T): Promise<T> {
  try {
    return await consulta();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      if (!avisoTablaFaltante) {
        avisoTablaFaltante = true;
        console.warn('[calendario] La tabla dias_no_laborables no existe: aplique la migración. Se asume que no hay feriados.');
      }
      return vacio;
    }
    throw error;
  }
}

export function mensajeDiaNoLaborable(dia: DiaNoLaborableInfo): string {
  return `Hoy es feriado (${dia.descripcion}): no hay marcación de asistencia.`;
}
