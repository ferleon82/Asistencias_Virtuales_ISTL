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
  const dia = await db.diaNoLaborable.findUnique({
    where: { fecha: ecuadorDbDate(now) },
    select: { fecha: true, descripcion: true },
  });
  return dia ? { fecha: dateOnlyKey(dia.fecha), descripcion: dia.descripcion } : null;
}

/** Fechas YYYY-MM-DD no laborables entre dos instantes (días de Ecuador, inclusive). */
export async function getFechasNoLaborables(from: Date, to: Date): Promise<Set<string>> {
  const dias = await prisma.diaNoLaborable.findMany({
    where: { fecha: { gte: ecuadorDbDate(from), lte: ecuadorDbDate(to) } },
    select: { fecha: true },
  });
  return new Set(dias.map((dia) => dateOnlyKey(dia.fecha)));
}

export function mensajeDiaNoLaborable(dia: DiaNoLaborableInfo): string {
  return `Hoy es feriado (${dia.descripcion}): no hay marcación de asistencia.`;
}
