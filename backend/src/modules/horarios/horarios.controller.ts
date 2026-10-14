import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/middleware/errorHandler';
import { horariosService } from './horarios.service';
import {
  asignacionParamsSchema,
  createHorarioSchema,
  horarioParamsSchema,
  horarioQuerySchema,
  jornadaSchema,
  updateHorarioSchema,
} from './horarios.schemas';
import { getClientIp } from '../../shared/utils/request';

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

function bloquesLabel(total: number): string {
  return `${total} ${total === 1 ? 'bloque' : 'bloques'}`;
}

export async function createJornada(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = jornadaSchema.parse(req.body);
    const horarios = await horariosService.createJornada(payload, requireUser(req), getClientIp(req));

    res.status(201).json({
      ok: true,
      message: `Jornada creada correctamente (${bloquesLabel(horarios.length)}).`,
      data: horarios,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateJornada(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { asignacionId } = asignacionParamsSchema.parse(req.params);
    const payload = jornadaSchema.parse(req.body);
    const horarios = await horariosService.updateJornada(asignacionId, payload, requireUser(req), getClientIp(req));

    res.status(200).json({
      ok: true,
      message: `Jornada actualizada correctamente (${bloquesLabel(horarios.length)}).`,
      data: horarios,
    });
  } catch (error) {
    next(error);
  }
}

export async function deactivateJornada(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { asignacionId } = asignacionParamsSchema.parse(req.params);
    const result = await horariosService.deactivateJornada(asignacionId, requireUser(req), getClientIp(req));

    res.status(200).json({
      ok: true,
      message: `Jornada desactivada (${bloquesLabel(result.horarios_desactivados)}).`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
