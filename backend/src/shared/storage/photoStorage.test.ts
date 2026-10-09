import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalPhotoStorage, SupabasePhotoStorage } from './photoStorage';

describe('LocalPhotoStorage', () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });

  it('guarda y lee una foto; devuelve null si no existe', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fotos-'));
    const storage = new LocalPhotoStorage(path.join(dir, 'asistencias'));

    await storage.save('u-entrada-1.jpg', Buffer.from('jpeg'), 'image/jpeg');

    expect((await storage.read('u-entrada-1.jpg'))?.toString()).toBe('jpeg');
    expect(await storage.read('no-existe.jpg')).toBeNull();
  });
});

describe('SupabasePhotoStorage', () => {
  const response = (status: number, body = '') => new Response(body || null, { status });

  it('sube al bucket privado con la service key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, '{}'));
    const storage = new SupabasePhotoStorage('https://abc.supabase.co/', 'service-key', 'asistencias-fotos', fetchMock);

    await storage.save('u-entrada-1.jpg', Buffer.from('jpeg'), 'image/jpeg');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://abc.supabase.co/storage/v1/object/asistencias-fotos/u-entrada-1.jpg');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer service-key', apikey: 'service-key', 'Content-Type': 'image/jpeg', 'x-upsert': 'false' });
  });

  it('falla de forma explícita si Supabase rechaza la subida', async () => {
    const storage = new SupabasePhotoStorage('https://abc.supabase.co', 'k', 'b', vi.fn().mockResolvedValue(response(403, 'denied')));
    await expect(storage.save('u-entrada-1.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow('403');
  });

  it('lee por la ruta autenticada y trata 400/404 como inexistente', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(200, 'jpeg')).mockResolvedValueOnce(response(400)).mockResolvedValueOnce(response(404));
    const storage = new SupabasePhotoStorage('https://abc.supabase.co', 'k', 'b', fetchMock);

    expect((await storage.read('u-entrada-1.jpg'))?.toString()).toBe('jpeg');
    expect(fetchMock.mock.calls[0][0]).toBe('https://abc.supabase.co/storage/v1/object/authenticated/b/u-entrada-1.jpg');
    expect(await storage.read('x.jpg')).toBeNull();
    expect(await storage.read('y.jpg')).toBeNull();
  });
});
