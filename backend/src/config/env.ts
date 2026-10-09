import { z } from 'zod';

/**
 * Variable opcional que trata la cadena vacía como ausente. docker-compose
 * pasa `${VAR:-}` como "" cuando la variable no está definida en .env.
 */
function optional<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('America/Guayaquil'),

  DATABASE_URL: z.string().url({ message: 'DATABASE_URL debe ser una URL valida de PostgreSQL' }),
  REDIS_URL: z.string().url({ message: 'REDIS_URL debe ser una URL valida de Redis' }).optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener minimo 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener minimo 32 caracteres'),
  JWT_ACCESS_EXPIRY: z.string().default('8h'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Saltos de proxy confiables delante de la API (Render = 1). 0 desactiva.
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:3000/api/v1/auth/google/callback'),
  GOOGLE_ALLOWED_DOMAIN: z.string().default('tecnologicoloja.edu.ec'),

  // Fotos de asistencia: disco local (desarrollo) o bucket privado de Supabase (producción).
  PHOTO_STORAGE: z.enum(['local', 'supabase']).default('local'),
  SUPABASE_URL: optional(z.string().url()),
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(1)),
  SUPABASE_PHOTO_BUCKET: z.string().min(1).default('asistencias-fotos'),

  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  API_RATE_LIMIT_MAX: z.coerce.number().default(1000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(5),
}).refine((data) => data.PHOTO_STORAGE !== 'supabase' || (data.SUPABASE_URL && data.SUPABASE_SERVICE_ROLE_KEY), {
  message: 'PHOTO_STORAGE=supabase requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY',
  path: ['PHOTO_STORAGE'],
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([key, msgs]) => `  - ${key}: ${msgs?.join(', ')}`)
      .join('\n');

    throw new Error(`\n[CONFIG] Variables de entorno invalidas:\n${messages}\n`);
  }

  return result.data;
}

export const env = validateEnv();
