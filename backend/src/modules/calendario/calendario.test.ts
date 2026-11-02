import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Rol } from '@prisma/client';

const state = vi.hoisted(() => ({ rol: 'talento_humano' }));

vi.mock('../../config/database', () => {
  const prisma = {
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    user: { findUnique: vi.fn(async () => ({ rol: state.rol, activo: true })) },
    diaNoLaborable: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma };
});

import { prisma } from '../../config/database';
import { createApp } from '../../app';
import { generateAccessToken, invalidateUserStatus } from '../../shared/utils/jwt';
import { CalendarioService } from './calendario.service';

const service = new CalendarioService();
const th = { id: 'th-1', rol: Rol.talento_humano };

describe('CalendarioService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.diaNoLaborable.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.diaNoLaborable.create).mockImplementation(((args: { data: { fecha: Date; descripcion: string } }) =>
      Promise.resolve({ id: `id-${args.data.fecha.toISOString().slice(0, 10)}`, ...args.data })) as never);
  });

  it('registra un rango como un día por fecha, en una transacción (carnaval)', async () => {
    const dias = await service.create({ fecha_inicio: '2027-02-08', fecha_fin: '2027-02-09', descripcion: 'Carnaval' }, th, '127.0.0.1');

    expect(dias).toEqual([
      { id: 'id-2027-02-08', fecha: '2027-02-08', descripcion: 'Carnaval' },
      { id: 'id-2027-02-09', fecha: '2027-02-09', descripcion: 'Carnaval' },
    ]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('cruza el fin de año sin perder ni repetir días', async () => {
    const dias = await service.create({ fecha_inicio: '2026-12-31', fecha_fin: '2027-01-02', descripcion: 'Receso' }, th, '127.0.0.1');
    expect(dias.map((dia) => dia.fecha)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('no registra nada si alguna fecha ya existe e indica cuál', async () => {
    vi.mocked(prisma.diaNoLaborable.findMany).mockResolvedValue([
      { id: 'x', fecha: new Date('2026-11-03T00:00:00Z'), descripcion: 'Independencia de Cuenca' },
    ] as never);

    await expect(
      service.create({ fecha_inicio: '2026-11-02', fecha_fin: '2026-11-03', descripcion: 'Difuntos' }, th, '127.0.0.1')
    ).rejects.toMatchObject({ statusCode: 409, message: 'Ya está registrado como no laborable: 03/11/2026 (Independencia de Cuenca).' });
    expect(prisma.diaNoLaborable.create).not.toHaveBeenCalled();
  });

  it('limita la cantidad de días por registro', async () => {
    await expect(
      service.create({ fecha_inicio: '2027-01-01', fecha_fin: '2027-03-01', descripcion: 'Rango largo' }, th, '127.0.0.1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('API /api/v1/calendario/dias-no-laborables', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  const request = (method: string, rol: string, body?: unknown) =>
    new Promise<number>((resolve, reject) => {
      state.rol = rol;
      invalidateUserStatus('u-1');
      const token = generateAccessToken({ sub: 'u-1', email: 'u@tecnologicoloja.edu.ec', rol });
      const payload = body ? JSON.stringify(body) : undefined;
      const req = http.request(
        {
          port,
          method,
          path: '/api/v1/calendario/dias-no-laborables',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });

  beforeEach(() => {
    vi.mocked(prisma.diaNoLaborable.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.diaNoLaborable.create).mockResolvedValue({ id: 'n', fecha: new Date('2026-11-02T00:00:00Z'), descripcion: 'Difuntos' } as never);
  });

  const nuevo = { fecha_inicio: '2026-11-02', descripcion: 'Día de Difuntos' };

  it.each(['talento_humano', 'tics'])('%s puede registrar días no laborables', async (rol) => {
    expect(await request('POST', rol, nuevo)).toBe(201);
  });

  it.each(['docente', 'coordinador', 'rectorado'])('%s no puede registrarlos pero sí consultarlos', async (rol) => {
    expect(await request('POST', rol, nuevo)).toBe(403);
    expect(await request('GET', rol)).toBe(200);
  });
});
