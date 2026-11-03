import { Jornada, type DiaSemana } from '@prisma/client';
import { dateOnlyKey } from '../../shared/attendance/clock';

/** Rango de fechas `YYYY-MM-DD` (inclusive) en que una jornada temporal pausa la regular. */
export interface Pausa {
  desde: string;
  hasta: string;
}

interface BloqueVigente {
  docente_id: string;
  dia_semana: DiaSemana;
  temporal: boolean;
  fecha_inicio: Date;
  fecha_fin: Date;
}

/** Jornada (matutina, vespertina o nocturna) según la hora de inicio del bloque. */
export function jornadaPorHora(horaInicio: string): Jornada {
  if (horaInicio < '13:00') return Jornada.matutina;
  if (horaInicio < '18:00') return Jornada.vespertina;
  return Jornada.nocturna;
}

/**
 * Bloques que el docente debe cumplir un día, a partir de los bloques vigentes
 * en esa fecha (de cualquier día de la semana): si alguno es de una jornada
 * temporal, la regular queda en pausa y solo cuentan los temporales.
 */
export function bloquesDelDia<T extends Pick<BloqueVigente, 'dia_semana' | 'temporal'>>(vigentes: T[], dia: DiaSemana): T[] {
  const hayTemporal = vigentes.some((bloque) => bloque.temporal);
  return vigentes.filter((bloque) => bloque.dia_semana === dia && (!hayTemporal || bloque.temporal));
}

/** Rangos en que cada docente tiene una jornada temporal, a partir de sus bloques. */
export function pausasPorDocente(bloques: BloqueVigente[]): Map<string, Pausa[]> {
  const pausas = new Map<string, Pausa[]>();
  bloques
    .filter((bloque) => bloque.temporal)
    .forEach((bloque) => {
      const pausa = { desde: dateOnlyKey(bloque.fecha_inicio), hasta: dateOnlyKey(bloque.fecha_fin) };
      const actuales = pausas.get(bloque.docente_id) ?? [];
      if (!actuales.some((item) => item.desde === pausa.desde && item.hasta === pausa.hasta)) actuales.push(pausa);
      pausas.set(bloque.docente_id, actuales);
    });
  return pausas;
}

/** `dd/mm/yyyy` de una fecha `@db.Date`. */
export function formatFecha(fecha: Date): string {
  return dateOnlyKey(fecha).split('-').reverse().join('/');
}
