import { describe, expect, it } from 'vitest';
import { DiaSemana, EstadoAsistencia } from '@prisma/client';
import { buildAttendanceSummary, type AttendanceMark, type ScheduleSlot } from './reportes.sessions';

const carrera = { nombre: 'Desarrollo de Software', codigo: 'TSDS' };

// Semana del lunes 5 al sábado 10 de octubre de 2026 (hora de Ecuador).
const from = new Date('2026-10-05T00:00:00-05:00');
const to = new Date('2026-10-10T23:59:59-05:00');
const afterWeek = new Date('2026-10-11T12:00:00-05:00');

const slot = (overrides: Partial<ScheduleSlot> = {}): ScheduleSlot => ({
  id: 'horario-lunes',
  dia_semana: DiaSemana.lunes,
  hora_inicio: '08:00',
  fecha_inicio: new Date('2026-09-01T00:00:00.000Z'),
  fecha_fin: new Date('2027-02-28T00:00:00.000Z'),
  grupo: carrera,
  ...overrides,
});

const mark = (overrides: Partial<AttendanceMark> = {}): AttendanceMark => ({
  slotId: 'horario-lunes',
  grupo: carrera,
  estado: EstadoAsistencia.puntual,
  timestamp_entrada: new Date('2026-10-05T07:58:00-05:00'),
  created_at: new Date('2026-10-05T07:58:00-05:00'),
  ...overrides,
});

describe('buildAttendanceSummary', () => {
  it('cuenta una sesión por bloque y día de la semana dentro del rango', () => {
    const summary = buildAttendanceSummary({ from, to, now: afterWeek, slots: [slot()], marks: [mark()] });

    expect(summary.totals).toMatchObject({ programadas: 1, presentes: 1, puntual: 1, ausente: 0, registros: 1 });
    expect(summary.porDia).toHaveLength(6);
    expect(summary.porGrupo).toEqual([expect.objectContaining({ codigo: 'TSDS', programadas: 1, presentes: 1 })]);
  });

  it('no programa sesiones fuera de la vigencia del bloque', () => {
    const summary = buildAttendanceSummary({
      from,
      to,
      now: afterWeek,
      slots: [slot({ fecha_inicio: new Date('2026-10-06T00:00:00.000Z') })],
      marks: [],
    });

    expect(summary.totals.programadas).toBe(0);
    expect(summary.totals.ausente).toBe(0);
  });

  it('respeta el primer día de vigencia aunque la columna Date llegue como medianoche UTC', () => {
    const summary = buildAttendanceSummary({
      from,
      to,
      now: afterWeek,
      slots: [slot({ fecha_inicio: new Date('2026-10-05T00:00:00.000Z') })],
      marks: [],
    });

    expect(summary.totals.programadas).toBe(1);
  });

  it('no cuenta como ausente una clase de hoy que todavía no empieza', () => {
    const summary = buildAttendanceSummary({
      from,
      to,
      now: new Date('2026-10-05T07:30:00-05:00'),
      slots: [slot()],
      marks: [],
    });

    expect(summary.totals.programadas).toBe(0);
    expect(summary.totals.ausente).toBe(0);
  });

  it('cuenta como ausente una sesión pasada sin marcación', () => {
    const summary = buildAttendanceSummary({ from, to, now: afterWeek, slots: [slot()], marks: [] });

    expect(summary.totals).toMatchObject({ programadas: 1, presentes: 0, ausente: 1 });
  });

  it('una justificación aprobada sin marcación no se cuenta como ausencia', () => {
    const summary = buildAttendanceSummary({
      from,
      to,
      now: afterWeek,
      slots: [slot()],
      marks: [
        mark({
          estado: EstadoAsistencia.justificado,
          timestamp_entrada: null,
          created_at: new Date('2026-10-05T08:05:00-05:00'),
        }),
      ],
    });

    expect(summary.totals).toMatchObject({ programadas: 1, presentes: 0, justificado: 1, ausente: 0 });
  });

  it('una justificación pendiente sin marcación cuenta una sola ausencia', () => {
    const summary = buildAttendanceSummary({
      from,
      to,
      now: afterWeek,
      slots: [slot()],
      marks: [
        mark({
          estado: EstadoAsistencia.ausente,
          timestamp_entrada: null,
          created_at: new Date('2026-10-05T08:05:00-05:00'),
        }),
      ],
    });

    expect(summary.totals).toMatchObject({ programadas: 1, registros: 1, ausente: 1 });
  });

  it('conserva sesiones con marcación aunque el horario ya no esté activo', () => {
    const summary = buildAttendanceSummary({ from, to, now: afterWeek, slots: [], marks: [mark()] });

    expect(summary.totals).toMatchObject({ programadas: 1, presentes: 1, ausente: 0 });
  });

  it('ubica las marcaciones nocturnas en su día de Ecuador y no en el día UTC', () => {
    const summary = buildAttendanceSummary({
      from,
      to,
      now: afterWeek,
      slots: [slot({ hora_inicio: '20:00' })],
      marks: [mark({ timestamp_entrada: new Date('2026-10-05T20:01:00-05:00') })],
    });

    expect(summary.totals).toMatchObject({ programadas: 1, presentes: 1, ausente: 0 });
    expect(summary.porDia[0]).toMatchObject({ presentes: 1, programadas: 1 });
  });

  it('presentes + justificadas sin entrada + ausentes suman las programadas', () => {
    const slots = [slot(), slot({ id: 'horario-martes', dia_semana: DiaSemana.martes }), slot({ id: 'horario-miercoles', dia_semana: DiaSemana.miercoles })];
    const marks = [
      mark(),
      mark({
        slotId: 'horario-martes',
        estado: EstadoAsistencia.justificado,
        timestamp_entrada: null,
        created_at: new Date('2026-10-06T09:00:00-05:00'),
      }),
    ];
    const summary = buildAttendanceSummary({ from, to, now: afterWeek, slots, marks });

    expect(summary.totals).toMatchObject({ programadas: 3, presentes: 1, justificado: 1, ausente: 1 });
  });
});
