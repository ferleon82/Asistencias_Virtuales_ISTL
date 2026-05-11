import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../shared/utils/jwt';
import { AppError } from '../../shared/middleware/errorHandler';
import type { Rol } from '@prisma/client';

/**
 * Middleware de autorización por rol.
 * Úsalo después de `authenticate`.
 *
 * Ejemplo: router.get('/admin', authenticate, authorize('tics', 'rectorado'), handler)
 */
export function authorize(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('No autenticado.', 401));
    }

    const userRol = req.user.rol as Rol;

    if (!roles.includes(userRol)) {
      return next(
        new AppError(
          `Acceso denegado. Esta acción requiere uno de los siguientes roles: ${roles.join(', ')}.`,
          403
        )
      );
    }

    next();
  };
}

// Re-exportar authenticate para uso conveniente
export { authenticate };
