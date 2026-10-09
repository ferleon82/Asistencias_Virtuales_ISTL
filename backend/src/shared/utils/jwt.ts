import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { prisma } from '../../config/database';
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

// ─── Estado vigente del usuario ─────────────────────────────────────────────────

// El token puede durar horas: en cada petición se confirma con la base que el
// usuario siga activo y se usa su rol actual. Se cachea unos segundos para no
// consultar la base en cada petición del panel.
const USER_STATUS_TTL_MS = 30_000;
const userStatusCache = new Map<string, { rol: string; activo: boolean; expiresAt: number }>();

async function getUserStatus(userId: string): Promise<{ rol: string; activo: boolean } | null> {
  const cached = userStatusCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rol: true, activo: true } });
  if (!user) {
    userStatusCache.delete(userId);
    return null;
  }

  const status = { rol: user.rol, activo: user.activo, expiresAt: Date.now() + USER_STATUS_TTL_MS };
  userStatusCache.set(userId, status);
  return status;
}

/** Descarta el estado cacheado tras cambiar el rol o desactivar a un usuario. */
export function invalidateUserStatus(userId: string): void {
  userStatusCache.delete(userId);
}

// ─── Middleware de autenticación ────────────────────────────────────────────────

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Token de acceso requerido.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    const status = await getUserStatus(payload.sub);
    if (!status || !status.activo) {
      throw new AppError('Su cuenta no está activa. Inicie sesión nuevamente.', 401);
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      rol: status.rol,
    };
    next();
  } catch (error) {
    next(error);
  }
}
