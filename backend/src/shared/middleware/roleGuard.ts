import { Request, Response, NextFunction } from 'express';
import { Rol } from '@prisma/client';
import { AppError } from './errorHandler';
import { authenticate } from '../utils/jwt';

/**
 * Middleware de control de acceso por rol.
 * Debe usarse DESPUÉS del middleware `authenticate`.
 */
export function roleGuard(...allowedRoles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Autenticación requerida.', 401));
    }

    if (!allowedRoles.includes(req.user.rol as Rol)) {
      return next(
        new AppError(
          `No tiene permisos para esta acción. Roles permitidos: ${allowedRoles.join(', ')}.`,
          403
        )
      );
    }

    next();
  };
}

/** Solo docentes */
export const soloDocente = [authenticate, roleGuard(Rol.docente)];

/** Solo coordinadores y superiores */
export const soloCoordinador = [authenticate, roleGuard(Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano)];

/** Solo TICs, Rectorado y Talento Humano */
export const soloAdministrador = [authenticate, roleGuard(Rol.tics, Rol.rectorado, Rol.talento_humano)];

/** Todos los roles autenticados */
export const todoRol = [authenticate, roleGuard(Rol.docente, Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano)];
