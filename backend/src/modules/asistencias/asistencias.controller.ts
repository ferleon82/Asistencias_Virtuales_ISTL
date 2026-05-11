import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/middleware/errorHandler';
import { asistenciasService } from './asistencias.service';
import {
  asistenciaParamsSchema,
  justificarAsistenciaSchema,
  listAsistenciasQuerySchema,
  locationSchema,
} from './asistencias.schemas';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError('Autenticacion requerida.', 401);
  }
  return req.user;
}

export async function getEstadoActual(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const estado = await asistenciasService.getEstadoActual(requireUser(req));
    res.status(200).json({ ok: true, data: estado });
  } catch (error) {
    next(error);
  }
}

export async function marcarEntrada(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const location = locationSchema.parse(req.body);
    const registro = await asistenciasService.marcarEntrada(
      requireUser(req),
      location,
      getClientIp(req),
      req.headers['user-agent']
    );

    res.status(201).json({
      ok: true,
      message: 'Ingreso registrado correctamente.',
      data: registro,
    });
  } catch (error) {
    next(error);
  }
}

export async function marcarSalida(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const location = locationSchema.parse(req.body);
    const registro = await asistenciasService.marcarSalida(requireUser(req), location, getClientIp(req));

    res.status(200).json({
      ok: true,
      message: 'Salida registrada correctamente.',
      data: registro,
    });
  } catch (error) {
    next(error);
  }
}

export async function listAsistencias(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = listAsistenciasQuerySchema.parse(req.query);
    const registros = await asistenciasService.list(filters, requireUser(req));

    res.status(200).json({
      ok: true,
      data: registros,
    });
  } catch (error) {
    next(error);
  }
}

export async function solicitarJustificacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = asistenciaParamsSchema.parse(req.params);
    const payload = justificarAsistenciaSchema.parse(req.body);
    const registro = await asistenciasService.solicitarJustificacion(id, payload, requireUser(req), getClientIp(req));

    res.status(200).json({
      ok: true,
      message: 'Justificacion enviada correctamente.',
      data: registro,
    });
  } catch (error) {
    next(error);
  }
}

export async function aprobarJustificacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = asistenciaParamsSchema.parse(req.params);
    const registro = await asistenciasService.aprobarJustificacion(id, requireUser(req), getClientIp(req));

    res.status(200).json({
      ok: true,
      message: 'Justificacion aprobada correctamente.',
      data: registro,
    });
  } catch (error) {
    next(error);
  }
}

export async function rechazarJustificacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = asistenciaParamsSchema.parse(req.params);
    const registro = await asistenciasService.rechazarJustificacion(id, requireUser(req), getClientIp(req));

    res.status(200).json({
      ok: true,
      message: 'Justificacion rechazada correctamente.',
      data: registro,
    });
  } catch (error) {
    next(error);
  }
}
