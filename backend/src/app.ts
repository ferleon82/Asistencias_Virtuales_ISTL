import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler';
import { apiRateLimiter } from './shared/middleware/rateLimiter';

// ─── Rutas ─────────────────────────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes';
import horariosRoutes from './modules/horarios/horarios.routes';
import asistenciasRoutes from './modules/asistencias/asistencias.routes';
import reportesRoutes from './modules/reportes/reportes.routes';
import docsRoutes from './modules/docs/docs.routes';
import adminRoutes from './modules/admin/admin.routes';

// ─── Aplicación Express ────────────────────────────────────────────────────────

export function createApp(): Application {
  const app = express();

  // ── Seguridad ────────────────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    })
  );

  // ── CORS ─────────────────────────────────────────────────────────────────────
  const allowedOrigins = [
    env.FRONTEND_URL,
    'https://asistencia.tecnologicoloja.edu.ec',
    'https://www.tecnologicoloja.edu.ec',
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Permitir requests sin origin (ej: Postman en desarrollo)
        if (!origin || env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error(`CORS: origen no permitido: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ── Parsers ──────────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(compression());

  // ── Logger ───────────────────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // ── Rate Limiting Global ──────────────────────────────────────────────────────
  app.use('/api', apiRateLimiter);
  app.use('/api', docsRoutes);

  // ── Health Check ─────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'ISTL Asistencia Virtual API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      timezone: process.env.TZ ?? 'America/Guayaquil',
    });
  });

  // ── Rutas API ────────────────────────────────────────────────────────────────
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/horarios', horariosRoutes);
  app.use('/api/v1/asistencias', asistenciasRoutes);
  app.use('/api/v1/reportes', reportesRoutes);
  app.use('/api/v1/admin', adminRoutes);

  // ── 404 ──────────────────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── Manejo global de errores ─────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
