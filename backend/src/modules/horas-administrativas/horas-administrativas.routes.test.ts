import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const state = vi.hoisted(() => ({ rol: 'talento_humano' }));

vi.mock('../../config/database', () => {
  const prisma = {
    user: { findUnique: vi.fn(async () => ({ rol: state.rol, activo: true })) },
    horarioAdministrativo: { findMany: vi.fn(async () => []) },
    registroAdministrativo: { findMany: vi.fn(async () => []) },
  };
  return { prisma };
});

import { createApp } from '../../app';
import { generateAccessToken, invalidateUserStatus } from '../../shared/utils/jwt';

describe('API /api/v1/horas-administrativas', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  const request = (method: string, path: string, rol: string, body?: unknown) =>
    new Promise<number>((resolve, reject) => {
      state.rol = rol;
      invalidateUserStatus('u-1');
      const token = generateAccessToken({ sub: 'u-1', email: 'u@tecnologicoloja.edu.ec', rol });
      const payload = body ? JSON.stringify(body) : undefined;
      const req = http.request(
        {
          port,
          method,
          path: `/api/v1/horas-administrativas${path}`,
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

  it.each(['talento_humano', 'tics'])('%s administra los bloques y ve las marcaciones', async (rol) => {
    expect(await request('GET', '?activo=true', rol)).toBe(200);
    expect(await request('GET', '/registros', rol)).toBe(200);
    // Datos inválidos: pasa el control de rol y lo rechaza la validación.
    expect(await request('POST', '/', rol, {})).toBe(400);
    expect(await request('POST', '/jornadas', rol, {})).toBe(400);
    expect(await request('POST', '/jornadas/lote', rol, {})).toBe(400);
  });

  it.each(['coordinador', 'rectorado'])('%s no puede administrarlos', async (rol) => {
    expect(await request('GET', '?activo=true', rol)).toBe(403);
    expect(await request('GET', '/registros', rol)).toBe(403);
    expect(await request('POST', '/', rol, {})).toBe(403);
    expect(await request('POST', '/jornadas', rol, {})).toBe(403);
    expect(await request('POST', '/jornadas/lote', rol, {})).toBe(403);
  });

  it('el docente consulta sus bloques pero no los crea', async () => {
    expect(await request('GET', '?activo=true', 'docente')).toBe(200);
    expect(await request('POST', '/', 'docente', {})).toBe(403);
    expect(await request('POST', '/jornadas', 'docente', {})).toBe(403);
    expect(await request('POST', '/jornadas/lote', 'docente', {})).toBe(403);
    expect(await request('DELETE', '/jornadas/550e8400-e29b-41d4-a716-446655440002', 'docente')).toBe(403);
  });
});
