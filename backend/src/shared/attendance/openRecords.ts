import { prisma } from '../../config/database';
import { ecuadorDayRange } from './clock';
import type { DbClient } from './lock';
import type { AttendanceWindows } from './settings';
import { marcacionAbiertaVigente } from './windows';

export type TipoMarcacion = 'clase' | 'administrativa';

/**
 * Busca una marcación del día (de clase o administrativa) que aún se puede
 * cerrar. Un docente no puede iniciar otra marcación mientras exista una.
 * Las marcaciones cuya ventana de salida ya venció no bloquean: quedan como
 * "salida pendiente" para justificar.
 */
export async function marcacionAbiertaQueBloquea(
  docenteId: string,
  now: Date,
  windows: AttendanceWindows,
  db: DbClient = prisma
): Promise<TipoMarcacion | null> {
  const where = { docente_id: docenteId, timestamp_salida: null, timestamp_entrada: ecuadorDayRange(now) };
  const [clases, administrativas] = await Promise.all([
    db.registroAsistencia.findMany({
      where,
      select: { timestamp_entrada: true, horario: { select: { hora_fin: true } } },
    }),
    db.registroAdministrativo.findMany({
      where,
      select: { timestamp_entrada: true, horario_administrativo: { select: { hora_fin: true } } },
    }),
  ]);

  const vigente = (entrada: Date | null, horaFin: string) => !!entrada && marcacionAbiertaVigente(entrada, horaFin, now, windows);

  if (clases.some((registro) => vigente(registro.timestamp_entrada, registro.horario.hora_fin))) return 'clase';
  if (administrativas.some((registro) => vigente(registro.timestamp_entrada, registro.horario_administrativo.hora_fin))) {
    return 'administrativa';
  }
  return null;
}
