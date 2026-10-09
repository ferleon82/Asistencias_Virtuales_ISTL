import { describe, expect, it } from 'vitest';
import { envSchema } from './env';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
};

describe('envSchema', () => {
  it('acepta las variables de Supabase vacías que pasa docker-compose cuando no están en .env', () => {
    const result = envSchema.safeParse({ ...base, PHOTO_STORAGE: 'local', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SUPABASE_URL).toBeUndefined();
      expect(result.data.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    }
  });

  it('exige URL y clave de Supabase cuando PHOTO_STORAGE=supabase, aunque lleguen vacías', () => {
    const result = envSchema.safeParse({ ...base, PHOTO_STORAGE: 'supabase', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' });
    expect(result.success).toBe(false);
  });

  it('sigue rechazando una URL de Supabase mal formada', () => {
    const result = envSchema.safeParse({ ...base, SUPABASE_URL: 'no-es-url' });
    expect(result.success).toBe(false);
  });
});
