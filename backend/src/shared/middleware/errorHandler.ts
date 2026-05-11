import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// ─── Clase de Error de Aplicación ──────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Tipos de error de Prisma ───────────────────────────────────────────────────

interface PrismaError {
  code?: string;
  meta?: { target?: string[] };
  message?: string;
}

function isPrismaError(error: unknown): error is PrismaError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// ─── Manejador Global de Errores ────────────────────────────────────────────────

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Error de aplicación conocido
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      ok: false,
      message: error.message,
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      ok: false,
      message: error.errors.map((item) => item.message).join('. '),
    });
    return;
  }

  // Errores de Prisma (base de datos)
  if (isPrismaError(error)) {
    // Unicidad violada
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] ?? 'campo';
      res.status(409).json({
        ok: false,
        message: `Ya existe un registro con ese ${field}. Verifique los datos e intente nuevamente.`,
      });
      return;
    }

    // Registro no encontrado
    if (error.code === 'P2025') {
      res.status(404).json({
        ok: false,
        message: 'El registro solicitado no fue encontrado.',
      });
      return;
    }

    // Violación de clave foránea
    if (error.code === 'P2003') {
      res.status(400).json({
        ok: false,
        message: 'Error de referencia: el registro relacionado no existe.',
      });
      return;
    }
  }

  const fallbackError = error instanceof Error ? error : new Error(String(error));

  // Error no controlado
  console.error('[ERROR NO CONTROLADO]', {
    message: fallbackError.message,
    stack: fallbackError.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  res.status(500).json({
    ok: false,
    message: 'Error interno del servidor. Contacte al área de TICs.',
  });
}

// ─── Manejador de rutas no encontradas ─────────────────────────────────────────

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    ok: false,
    message: `La ruta ${req.method} ${req.path} no existe en esta API.`,
  });
}
