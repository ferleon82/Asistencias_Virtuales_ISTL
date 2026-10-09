import { addMinutes, atEcuadorTime } from './clock';
import type { AttendanceWindows } from './settings';

/**
 * Minutos completos de tolerancia: es puntual hasta el último segundo del
 * minuto 5 (08:05:59 en una clase de 08:00), como en la regla original.
 */
export const PUNTUAL_TOLERANCE_MINUTES = 5;

export type EstadoEntrada = 'puntual' | 'tardanza' | 'fuera_de_ventana';

export interface TimeBlock {
  hora_inicio: string;
  hora_fin: string;
}

/** Estado de una entrada marcada en `at` para un bloque que inicia a `horaInicio` ese día. */
export function estadoEntrada(at: Date, horaInicio: string, windows: AttendanceWindows): EstadoEntrada {
  const inicio = atEcuadorTime(at, horaInicio);

  if (at < addMinutes(inicio, -windows.entryBeforeMinutes) || at > addMinutes(inicio, windows.entryAfterMinutes)) {
    return 'fuera_de_ventana';
  }

  return at < addMinutes(inicio, PUNTUAL_TOLERANCE_MINUTES + 1) ? 'puntual' : 'tardanza';
}

/** El bloque admite marcar entrada en `now`: dentro de la ventana y sin haber terminado. */
export function permiteEntrada(now: Date, block: TimeBlock, windows: AttendanceWindows): boolean {
  return now <= atEcuadorTime(now, block.hora_fin) && estadoEntrada(now, block.hora_inicio, windows) !== 'fuera_de_ventana';
}

/** Primer bloque del día que admite entrada en `now`. */
export function bloqueActivo<T extends TimeBlock>(blocks: T[], now: Date, windows: AttendanceWindows): T | null {
  return [...blocks]
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    .find((block) => permiteEntrada(now, block, windows)) ?? null;
}

/** Ventana de salida de una marcación abierta, calculada sobre el día de su entrada. */
export function ventanaSalida(entrada: Date, horaFin: string, windows: AttendanceWindows): { desde: Date; hasta: Date } {
  const fin = atEcuadorTime(entrada, horaFin);
  return { desde: addMinutes(fin, -windows.exitBeforeMinutes), hasta: addMinutes(fin, windows.exitAfterMinutes) };
}

/**
 * Una marcación sin salida solo bloquea nuevas entradas mientras todavía se
 * puede cerrar. Pasada la ventana de salida queda como "salida pendiente".
 */
export function marcacionAbiertaVigente(entrada: Date, horaFin: string, now: Date, windows: AttendanceWindows): boolean {
  return now <= ventanaSalida(entrada, horaFin, windows).hasta;
}
