import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EstadoAsistencia, Rol } from '@prisma/client';

vi.mock('../../config/database', () => ({
  prisma: { periodoAcademico: { findUnique: vi.fn() } },
}));

import { prisma } from '../../config/database';
import { estadoWhere, filterWhere, quedoSinSalida, resolveRange, scopedFilters } from './reportes.query';

const now = new Date('2026-10-09T21:30:00-05:00'); // en UTC ya es 10 de octubre
const iso = (date: Date) => date.toISOString();

describe('resolveRange', () => {
  beforeEach(() => vi.clearAllMocks());

  it('por defecto reporta el día actual de Ecuador', async () => {
    const range = await resolveRange({ tipo: 'docente' }, now);
    expect(iso(range.from)).toBe('2026-10-09T05:00:00.000Z');
    expect(iso(range.to)).toBe('2026-10-10T04:59:59.999Z');
  });

  it('toma las fechas del filtro como días completos de Ecuador', async () => {
    const range = await resolveRange({ tipo: 'docente', fecha_inicio: new Date('2026-09-01'), fecha_fin: new Date('2026-09-30') }, now);
    expect(iso(range.from)).toBe('2026-09-01T05:00:00.000Z');
    expect(iso(range.to)).toBe('2026-10-01T04:59:59.999Z');
  });

  it('con período en curso reporta desde su inicio hasta hoy', async () => {
    vi.mocked(prisma.periodoAcademico.findUnique).mockResolvedValue({
      fecha_inicio: new Date('2026-09-01T00:00:00Z'),
      fecha_fin: new Date('2027-02-28T00:00:00Z'),
    } as never);

    const range = await resolveRange({ tipo: 'docente', periodo_academico_id: 'p1' }, now);
    expect(iso(range.from)).toBe('2026-09-01T05:00:00.000Z');
    expect(iso(range.to)).toBe('2026-10-10T04:59:59.999Z');
  });

  it('con período terminado reporta hasta su último día', async () => {
    vi.mocked(prisma.periodoAcademico.findUnique).mockResolvedValue({
      fecha_inicio: new Date('2026-03-01T00:00:00Z'),
      fecha_fin: new Date('2026-07-31T00:00:00Z'),
    } as never);

    const range = await resolveRange({ tipo: 'docente', periodo_academico_id: 'p1' }, now);
    expect(iso(range.from)).toBe('2026-03-01T05:00:00.000Z');
    expect(iso(range.to)).toBe('2026-08-01T04:59:59.999Z');
  });

  it('las fechas explícitas tienen prioridad sobre el período', async () => {
    await resolveRange({ tipo: 'docente', periodo_academico_id: 'p1', fecha_inicio: new Date('2026-09-01') }, now);
    expect(prisma.periodoAcademico.findUnique).not.toHaveBeenCalled();
  });
});

describe('filtros por rol', () => {
  it('un docente solo ve sus propios registros aunque pida otro docente', () => {
    const scoped = scopedFilters({ tipo: 'docente', docente_id: 'otro' }, { id: 'yo', rol: Rol.docente });
    expect(scoped.docente_id).toBe('yo');
  });

  it('incluye justificaciones sin marcación ubicándolas por fecha de creación', () => {
    const from = new Date('2026-09-01T05:00:00Z');
    const to = new Date('2026-10-01T04:59:59.999Z');
    expect(filterWhere({ tipo: 'docente' }, from, to).OR).toEqual([
      { timestamp_entrada: { gte: from, lte: to } },
      { timestamp_entrada: null, created_at: { gte: from, lte: to } },
    ]);
  });
});

describe('marcaciones sin salida', () => {
  const windows = { entryBeforeMinutes: 15, entryAfterMinutes: 15, exitBeforeMinutes: 10, exitAfterMinutes: 15 };
  const abierta = { timestamp_entrada: new Date('2026-11-10T20:50:00-05:00'), timestamp_salida: null, estado: EstadoAsistencia.puntual };
  const at = (hora: string) => ({ now: new Date(`2026-11-10T${hora}:00-05:00`), windows });

  it('queda sin salida solo cuando termina la ventana de salida', () => {
    expect(quedoSinSalida(abierta, '22:00', at('22:15'))).toBe(false);
    expect(quedoSinSalida(abierta, '22:00', at('22:16'))).toBe(true);
  });

  it('no aplica si marcó salida, no tiene entrada o tiene justificación aprobada', () => {
    const tarde = at('23:30');
    expect(quedoSinSalida({ ...abierta, timestamp_salida: new Date('2026-11-10T22:01:00-05:00') }, '22:00', tarde)).toBe(false);
    expect(quedoSinSalida({ ...abierta, timestamp_entrada: null }, '22:00', tarde)).toBe(false);
    expect(quedoSinSalida({ ...abierta, estado: EstadoAsistencia.justificado }, '22:00', tarde)).toBe(false);
  });

  it('el filtro "sin_salida" busca marcaciones abiertas no justificadas', () => {
    expect(estadoWhere('sin_salida')).toEqual({ estado: { not: EstadoAsistencia.justificado }, timestamp_salida: null, NOT: { timestamp_entrada: null } });
    expect(estadoWhere(EstadoAsistencia.tardanza)).toEqual({ estado: EstadoAsistencia.tardanza });
  });
});
