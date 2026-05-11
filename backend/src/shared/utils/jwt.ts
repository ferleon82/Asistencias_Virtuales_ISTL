import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { AppError } from '../middleware/errorHandler';

// ─── Tipos extendidos para Express ─────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        rol: string;
      };
    }
  }
}

export interface JwtPayload {
  sub: string;
  email: string;
  rol: string;
  iat?: number;
  exp?: number;
}

// ─── Generación de tokens ───────────────────────────────────────────────────────

export function generateAccessToken(payload: { sub: string; email: string; rol: string }): string {
  return jwt.sign(
    { sub: payload.sub, email: payload.email, rol: payload.rol, jti: uuidv4() },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY as string } as jwt.SignOptions
  );
}

export function generateRefreshToken(payload: { sub: string; email: string; rol: string }): string {
  return jwt.sign(
    { sub: payload.sub, email: payload.email, rol: payload.rol, jti: uuidv4() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY as string } as jwt.SignOptions
  );
}

// ─── Verificación de tokens ─────────────────────────────────────────────────────

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('La sesión ha expirado. Renueve su token.', 401);
    }
    throw new AppError('Token de acceso inválido.', 401);
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('La sesión ha expirado. Inicie sesión nuevamente.', 401);
    }
    throw new AppError('Token de sesión inválido.', 401);
  }
}

// ─── Middleware de autenticación ────────────────────────────────────────────────

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Token de acceso requerido.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      rol: payload.rol,
    };
    next();
  } catch (error) {
    next(error);
  }
}
