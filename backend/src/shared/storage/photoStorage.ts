import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';

/**
 * Almacenamiento de fotos de asistencia. Las claves son nombres de archivo ya
 * validados (`<usuario>-<tipo>-<marca>.jpg|png`); nunca contienen rutas.
 */
export interface PhotoStorage {
  save(key: string, data: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer | null>;
}

export class LocalPhotoStorage implements PhotoStorage {
  constructor(private readonly dir = path.resolve(process.cwd(), 'uploads', 'asistencias')) {}

  async save(key: string, data: Buffer): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(path.join(this.dir, key), data);
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(this.dir, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
}

/**
 * Bucket privado de Supabase Storage mediante su API REST. Usa la service role
 * key, que solo vive en el backend; el bucket no debe ser público.
 */
export class SupabasePhotoStorage implements PhotoStorage {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  private objectUrl(key: string, authenticated = false): string {
    const base = this.url.replace(/\/+$/, '');
    return `${base}/storage/v1/object/${authenticated ? 'authenticated/' : ''}${this.bucket}/${encodeURIComponent(key)}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }

  async save(key: string, data: Buffer, contentType: string): Promise<void> {
    const response = await this.fetchImpl(this.objectUrl(key), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'x-upsert': 'false' }),
      body: data,
    });

    if (!response.ok) {
      throw new Error(`Supabase Storage rechazó la foto (${response.status}): ${await response.text()}`);
    }
  }

  async read(key: string): Promise<Buffer | null> {
    const response = await this.fetchImpl(this.objectUrl(key, true), { headers: this.headers() });

    // Supabase responde 400 u 404 cuando el objeto no existe.
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) {
      throw new Error(`No se pudo leer la foto de Supabase Storage (${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}

let storage: PhotoStorage | null = null;

export function getPhotoStorage(): PhotoStorage {
  if (!storage) {
    storage =
      env.PHOTO_STORAGE === 'supabase'
        ? new SupabasePhotoStorage(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, env.SUPABASE_PHOTO_BUCKET)
        : new LocalPhotoStorage();
  }
  return storage;
}
