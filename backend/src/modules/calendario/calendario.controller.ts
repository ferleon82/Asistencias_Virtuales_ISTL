import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/middleware/errorHandler';
import { getClientIp } from '../../shared/utils/request';
import { calendarioService } from './calendario.service';
import { crearDiasNoLaborablesSchema, diaNoLaborableParamsSchema, listarDiasNoLaborablesSchema } from './calendario.schemas';

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError('Autenticación requerida.', 401);
  }
  return req.user;
}

export async function listDiasNoLaborables(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = listarDiasNoLaborablesSchema.parse(req.query);
    res.status(200).json({ ok: true, data: await calendarioService.list(filters) });
  } catch (error) {
    next(error);
  }
}

export async function createDiasNoLaborables(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = crearDiasNoLaborablesSchema.parse(req.body);
    const dias = await calendarioService.create(payload, requireUser(req), getClientIp(req));
    res.status(201).json({
      ok: true,
      message: dias.length === 1 ? 'Día no laborable registrado.' : `${dias.length} días no laborables registrados.`,
      data: dias,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDiaNoLaborable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = diaNoLaborableParamsSchema.parse(req.params);
    const dia = await calendarioService.remove(id, requireUser(req), getClientIp(req));
    res.status(200).json({ ok: true, message: 'Día no laborable eliminado.', data: dia });
  } catch (error) {
    next(error);
  }
}
