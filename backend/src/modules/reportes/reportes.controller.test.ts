import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

vi.mock('../../config/database', () => ({
  prisma: { user: { findUnique: vi.fn().mockResolvedValue({ rol: 'talento_humano', activo: true }) } },
}));
const excel = vi.hoisted(() => vi.fn().mockResolvedValue(Buffer.from('xlsx')));
vi.mock('./reportes.service', () => ({ reportesService: { excel } }));

import { createApp } from '../../app';
import { generateAccessToken } from '../../shared/utils/jwt';

let server: Server;
let port: number;
const token = generateAccessToken({ sub: 'th-1', email: 'th@tecnologicoloja.edu.ec', rol: 'talento_humano' });

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('GET /api/v1/reportes/excel', () => {
  it('pasa al servicio la dirección pública vista detrás del proxy (https en Render)', async () => {
    // fetch no permite fijar Host; node:http sí, como lo hace el proxy de Render.
    const status = await new Promise<number>((resolve, reject) => {
      http
        .get(
          {
            port,
            path: '/api/v1/reportes/excel?tipo=docente',
            headers: { Authorization: `Bearer ${token}`, Host: 'istl-asistencia-backend.onrender.com', 'X-Forwarded-Proto': 'https' },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode ?? 0);
          }
        )
        .on('error', reject);
    });

    expect(status).toBe(200);
    expect(excel.mock.calls[0][2]).toBe('https://istl-asistencia-backend.onrender.com');
  });
});
