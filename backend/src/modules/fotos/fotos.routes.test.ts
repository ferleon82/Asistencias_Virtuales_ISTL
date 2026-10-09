import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const fotos = vi.hoisted(() => new Map<string, Buffer>());
vi.mock('../../shared/storage/photoStorage', () => ({
  getPhotoStorage: () => ({ save: vi.fn(), read: async (key: string) => fotos.get(key) ?? null }),
}));

import { createApp } from '../../app';
import { signPhotoUrl } from '../../shared/attendance/photoUrls';

let server: Server;
let base: string;

beforeAll(async () => {
  fotos.set('u-entrada-1.jpg', Buffer.from('jpeg-bytes'));
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('GET /api/v1/fotos/:archivo', () => {
  it('entrega la foto con un enlace firmado vigente', async () => {
    const res = await fetch(base + signPhotoUrl('/uploads/asistencias/u-entrada-1.jpg', 60));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('private, max-age=300');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('jpeg-bytes');
  });

  it('rechaza el acceso sin firma', async () => {
    expect((await fetch(`${base}/api/v1/fotos/u-entrada-1.jpg`)).status).toBe(403);
  });

  it('ya no expone las fotos en /uploads', async () => {
    expect((await fetch(`${base}/uploads/asistencias/u-entrada-1.jpg`)).status).toBe(404);
  });

  it('responde 404 si la foto firmada no existe en el almacenamiento', async () => {
    const res = await fetch(base + signPhotoUrl('/uploads/asistencias/borrada-entrada-1.jpg', 60));
    expect(res.status).toBe(404);
  });
});
