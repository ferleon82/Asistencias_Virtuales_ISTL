import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Rol } from '@prisma/client';

vi.mock('../../config/database', () => ({
  prisma: { periodoAcademico: { findUnique: vi.fn() } },
}));

import { prisma } from '../../config/database';
import { filterWhere, resolveRange, scopedFilters } from './reportes.query';

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
