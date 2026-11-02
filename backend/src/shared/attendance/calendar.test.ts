import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../config/database', () => ({
  prisma: { diaNoLaborable: { findUnique: vi.fn(), findMany: vi.fn() } },
}));

import { prisma } from '../../config/database';
import { getDiaNoLaborable, getFechasNoLaborables } from './calendar';

const tablaFaltante = new Prisma.PrismaClientKnownRequestError('The table `public.dias_no_laborables` does not exist', {
  code: 'P2021',
  clientVersion: 'test',
});

describe('calendario institucional', () => {
  beforeEach(() => vi.clearAllMocks());

  it('busca el feriado por el día de Ecuador, no por el día UTC', async () => {
    vi.mocked(prisma.diaNoLaborable.findUnique).mockResolvedValue({ fecha: new Date('2026-11-02T00:00:00Z'), descripcion: 'Día de Difuntos' } as never);

    // 21:30 del 2 de noviembre en Ecuador ya es 3 de noviembre en UTC.
    const dia = await getDiaNoLaborable(new Date('2026-11-02T21:30:00-05:00'));

    expect(prisma.diaNoLaborable.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { fecha: new Date('2026-11-02T00:00:00Z') } }));
    expect(dia).toEqual({ fecha: '2026-11-02', descripcion: 'Día de Difuntos' });
  });

  it('si la migración aún no se aplicó, asume que no hay feriados en lugar de fallar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(prisma.diaNoLaborable.findUnique).mockRejectedValue(tablaFaltante);
    vi.mocked(prisma.diaNoLaborable.findMany).mockRejectedValue(tablaFaltante);

    await expect(getDiaNoLaborable(new Date())).resolves.toBeNull();
    await expect(getFechasNoLaborables(new Date(), new Date())).resolves.toEqual(new Set());
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('no oculta otros errores de base de datos', async () => {
    vi.mocked(prisma.diaNoLaborable.findUnique).mockRejectedValue(new Error('conexión perdida'));
    await expect(getDiaNoLaborable(new Date())).rejects.toThrow('conexión perdida');
  });
});
