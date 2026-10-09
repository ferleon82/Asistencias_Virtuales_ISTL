import { DiaSemana, EstadoAsistencia } from '@prisma/client';
import { ECUADOR_TZ, dateOnlyKey, ecuadorDateKey } from '../../shared/attendance/clock';

// Cálculo puro de sesiones programadas vs. marcaciones. No accede a la base de
// datos para poder probarse de forma aislada y reutilizarse en los reportes de
// clases y de jornada administrativa.

const ECUADOR_OFFSET = '-05:00';

const DAY_NUMBER: Record<DiaSemana, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export interface SessionGroup {
  nombre: string;
  codigo: string;
}

/** Bloque semanal (horario de clase u hora administrativa). */
export interface ScheduleSlot {
  id: string;
  dia_semana: DiaSemana;
  hora_inicio: string;
  /** Columnas @db.Date: Prisma las entrega como medianoche UTC. */
  fecha_inicio: Date;
  fecha_fin: Date;
  grupo: SessionGroup;
}

/** Registro de asistencia (con o sin entrada) asociado a un bloque. */
export interface AttendanceMark {
  slotId: string;
  grupo: SessionGroup;
  estado: EstadoAsistencia;
  timestamp_entrada: Date | null;
  created_at: Date;
}

export interface SessionCounters {
  programadas: number;
  registros: number;
  presentes: number;
  puntual: number;
  tardanza: number;
  ausente: number;
  justificado: number;
}

export interface GroupSummary extends SessionCounters {
  carrera: string;
  codigo: string;
}

export interface DaySummary extends SessionCounters {
  periodo: string;
}

export interface AttendanceSessionSummary {
  totals: SessionCounters;
  porGrupo: GroupSummary[];
  porDia: DaySummary[];
}

interface SessionState {
  grupo: SessionGroup;
  dateKey: string;
  presente: boolean;
  justificadoSinEntrada: boolean;
}

function emptyCounters(): SessionCounters {
  return { programadas: 0, registros: 0, presentes: 0, puntual: 0, tardanza: 0, ausente: 0, justificado: 0 };
}

function dayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: ECUADOR_TZ,
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${dateKey}T12:00:00${ECUADOR_OFFSET}`));
}

/** Recorre los días calendario entre dos instantes, inclusive, en hora de Ecuador. */
function eachDateKey(from: Date, to: Date): Array<{ key: string; weekday: number }> {
  const days: Array<{ key: string; weekday: number }> = [];
  const end = ecuadorDateKey(to);
  const cursor = new Date(`${ecuadorDateKey(from)}T00:00:00Z`);

  while (dateOnlyKey(cursor) <= end) {
    days.push({ key: dateOnlyKey(cursor), weekday: cursor.getUTCDay() });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function sessionStart(dateKey: string, horaInicio: string): Date {
  return new Date(`${dateKey}T${horaInicio}:00${ECUADOR_OFFSET}`);
}

/**
 * Cruza los bloques programados con las marcaciones del rango.
 *
 * Reglas:
 * - Una sesión se programa solo si cae dentro de la vigencia del bloque y ya
 *   comenzó (`now`); las clases que aún no inician no cuentan como ausencias.
 * - Cada sesión termina en un único estado: presente (tiene entrada),
 *   justificada sin entrada (justificación aprobada) o ausente.
 *   Por eso presentes + justificadas sin entrada + ausentes = programadas.
 * - Una marcación de un bloque que ya no está activo también crea su sesión,
 *   para no perder historial.
 */
export function buildAttendanceSummary(input: {
  from: Date;
  to: Date;
  now: Date;
  slots: ScheduleSlot[];
  marks: AttendanceMark[];
}): AttendanceSessionSummary {
  const days = eachDateKey(input.from, input.to);
  const sessions = new Map<string, SessionState>();
  const porDia = new Map<string, DaySummary>(days.map((day) => [day.key, { periodo: dayLabel(day.key), ...emptyCounters() }]));
  const porGrupo = new Map<string, GroupSummary>();

  const groupSummary = (grupo: SessionGroup): GroupSummary => {
    const current = porGrupo.get(grupo.codigo) ?? { carrera: grupo.nombre, codigo: grupo.codigo, ...emptyCounters() };
    porGrupo.set(grupo.codigo, current);
    return current;
  };
  const daySummary = (dateKey: string): DaySummary => {
    const current = porDia.get(dateKey) ?? { periodo: dayLabel(dateKey), ...emptyCounters() };
    porDia.set(dateKey, current);
    return current;
  };
  const ensureSession = (slotId: string, dateKey: string, grupo: SessionGroup): SessionState => {
    const key = `${slotId}:${dateKey}`;
    const existing = sessions.get(key);
    if (existing) return existing;
    const created: SessionState = { grupo, dateKey, presente: false, justificadoSinEntrada: false };
    sessions.set(key, created);
    return created;
  };

  input.slots.forEach((slot) => {
    const vigenteDesde = dateOnlyKey(slot.fecha_inicio);
    const vigenteHasta = dateOnlyKey(slot.fecha_fin);

    days
      .filter((day) => day.weekday === DAY_NUMBER[slot.dia_semana])
      .filter((day) => day.key >= vigenteDesde && day.key <= vigenteHasta)
      .filter((day) => sessionStart(day.key, slot.hora_inicio) <= input.now)
      .forEach((day) => ensureSession(slot.id, day.key, slot.grupo));
  });

  const totals = emptyCounters();

  input.marks.forEach((mark) => {
    const dateKey = ecuadorDateKey(mark.timestamp_entrada ?? mark.created_at);
    const session = ensureSession(mark.slotId, dateKey, mark.grupo);

    if (mark.timestamp_entrada) {
      session.presente = true;
    } else if (mark.estado === EstadoAsistencia.justificado) {
      session.justificadoSinEntrada = true;
    }

    // Los estados "ausente" se derivan de las sesiones, no de los registros,
    // para no contar dos veces una justificación pendiente o rechazada.
    [totals, groupSummary(mark.grupo), daySummary(dateKey)].forEach((counter) => {
      counter.registros += 1;
      if (mark.estado !== EstadoAsistencia.ausente) {
        counter[mark.estado] += 1;
      }
    });
  });

  sessions.forEach((session) => {
    [totals, groupSummary(session.grupo), daySummary(session.dateKey)].forEach((counter) => {
      counter.programadas += 1;
      if (session.presente) {
        counter.presentes += 1;
      } else if (!session.justificadoSinEntrada) {
        counter.ausente += 1;
      }
    });
  });

  return {
    totals,
    porGrupo: Array.from(porGrupo.values()).sort((a, b) => a.carrera.localeCompare(b.carrera)),
    porDia: Array.from(porDia.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, summary]) => summary),
  };
}
