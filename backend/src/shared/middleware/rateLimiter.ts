import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';

/**
 * Rate limiter general para rutas de API.
 * Debe ser suficientemente amplio para paneles autenticados con varias
 * consultas paralelas, sin reemplazar límites estrictos de acciones sensibles.
 */
export const apiRateLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  max: env.API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: `Demasiadas peticiones desde esta IP. Intente nuevamente en ${Math.ceil(env.API_RATE_LIMIT_WINDOW_MS / 60000)} minutos.`,
  },
});

/**
 * Rate limiter estricto para login.
 * 5 intentos por IP cada 15 minutos (requisito de seguridad ISTL).
 */
export const loginRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Solo cuenta intentos fallidos
  message: {
    ok: false,
    message: `Demasiados intentos de inicio de sesión. Intente nuevamente en ${Math.ceil(env.RATE_LIMIT_WINDOW_MS / 60000)} minutos.`,
  },
});

/**
 * Rate limiter para registro de asistencia.
 * Máximo 10 marcas por minuto por IP.
 */
export const asistenciaRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Demasiadas solicitudes de asistencia. Espere un momento.',
  },
});
