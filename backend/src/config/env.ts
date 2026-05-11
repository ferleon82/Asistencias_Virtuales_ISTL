import { z } from 'zod';

// ─── Schema de validación de variables de entorno ──────────────────────────────
const envSchema = z.object({
  // Servidor
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('America/Guayaquil'),

  // Base de Datos
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL debe ser una URL válida de PostgreSQL' }),

  // Redis
  REDIS_URL: z.string().url({ message: 'REDIS_URL debe ser una URL válida de Redis' }),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener mínimo 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener mínimo 32 caracteres'),
  JWT_ACCESS_EXPIRY: z.string().default('8h'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // CORS
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Google OAuth institucional
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:3000/api/v1/auth/google/callback'),
  GOOGLE_ALLOWED_DOMAIN: z.string().default('tecnologicoloja.edu.ec'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutos
  RATE_LIMIT_MAX: z.coerce.number().default(5),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([key, msgs]) => `  ✗ ${key}: ${msgs?.join(', ')}`)
      .join('\n');

    throw new Error(`\n[CONFIG] Variables de entorno inválidas:\n${messages}\n`);
  }

  return result.data;
}

export const env = validateEnv();
