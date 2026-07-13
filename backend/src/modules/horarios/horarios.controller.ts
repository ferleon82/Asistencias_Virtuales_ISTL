import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/middleware/errorHandler';
import { horariosService } from './horarios.service';
import { createHorarioSchema, horarioParamsSchema, horarioQuerySchema, updateHorarioSchema } from './horarios.schemas';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError('Autenticación requerida.', 401);
  }
  return req.user;
}

export async function listHorarios(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = horarioQuerySchema.parse(req.query);
    const horarios = await horariosService.list(filters, requireUser(req));

    res.status(200).json({
      ok: true,
      data: horarios,
    });
  } catch (error) {
    next(error);
  }
}

export async function getHorario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = horarioParamsSchema.parse(req.params);
    const horario = await horariosService.getById(id, requireUser(req));

    res.status(200).json({
      ok: true,
      data: horario,
    });
  } catch (error) {
    next(error);
  }
}

export async function createHorario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = createHorarioSchema.parse(req.body);
    const horario = await horariosService.create(payload, requireUser(req), getClientIp(req));

    res.status(201).json({
      ok: true,
      message: 'Horario creado correctamente.',
      data: horario,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateHorario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = horarioParamsSchema.parse(req.params);
    const payload = updateHorarioSchema.parse(req.body);
    const horario = await horariosService.update(id, payload, requireUser(req), getClientIp(req));

    res.status(200).json({
      ok: true,
      message: 'Horario actualizado correctamente.',
      data: horario,
    });
  } catch (error) {
    next(error);
  }
}

export async function deactivateHorario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = horarioParamsSchema.parse(req.params);
    const horario = await horariosService.deactivate(id, requireUser(req), getClientIp(req));

    res.status(200).json({
      ok: true,
      message: 'Horario desactivado correctamente.',
      data: horario,
    });
  } catch (error) {
    next(error);
  }
}
