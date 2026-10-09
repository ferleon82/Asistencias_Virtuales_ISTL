import { DiaSemana } from '@prisma/client';

// Reloj de Ecuador independiente de la zona horaria del servidor.
// Ecuador no tiene horario de verano, así que el desplazamiento es fijo.

export const ECUADOR_TZ = 'America/Guayaquil';
const ECUADOR_OFFSET = '-05:00';
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS: Array<DiaSemana | null> = [
  null,
  DiaSemana.lunes,
  DiaSemana.martes,
  DiaSemana.miercoles,
  DiaSemana.jueves,
  DiaSemana.viernes,
  DiaSemana.sabado,
];

/** Instante actual. Se expone como función para poder simularlo en las pruebas. */
export function currentTime(): Date {
  return new Date();
}

/** Fecha calendario (YYYY-MM-DD) del instante en hora de Ecuador. */
export function ecuadorDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ECUADOR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Instante de una hora `HH:mm` en el mismo día de Ecuador que `reference`. */
export function atEcuadorTime(reference: Date, time: string): Date {
  return new Date(`${ecuadorDateKey(reference)}T${time}:00${ECUADOR_OFFSET}`);
}

/** Inicio y fin del día de Ecuador que contiene `reference`. */
export function ecuadorDayRange(reference: Date): { gte: Date; lte: Date } {
  const start = atEcuadorTime(reference, '00:00');
  return { gte: start, lte: new Date(start.getTime() + DAY_MS - 1) };
}

/**
 * Día de Ecuador como valor para comparar con columnas `@db.Date`, que Prisma
 * maneja como medianoche UTC. Comparar esas columnas con el instante actual
 * dejaba fuera el último día de cada período.
 */
export function ecuadorDbDate(reference: Date): Date {
  return new Date(`${ecuadorDateKey(reference)}T00:00:00Z`);
}

/** Día de la semana en Ecuador; `null` para domingo. */
export function ecuadorWeekday(reference: Date): DiaSemana | null {
  return WEEKDAYS[ecuadorDbDate(reference).getUTCDay()];
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
