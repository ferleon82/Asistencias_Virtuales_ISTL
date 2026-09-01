import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/middleware/errorHandler';
import { horasAdministrativasService } from './horas-administrativas.service';
import { createHorarioAdministrativoSchema, horarioAdministrativoParamsSchema, horarioAdministrativoQuerySchema, locationSchema, updateHorarioAdministrativoSchema } from './horas-administrativas.schemas';

function user(req: Request) { if (!req.user) throw new AppError('Autenticación requerida.', 401); return req.user; }
function ip(req: Request) { const forwarded = req.headers['x-forwarded-for']; return forwarded ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim()) : req.socket.remoteAddress ?? 'unknown'; }

export async function listHorariosAdministrativos(req: Request, res: Response, next: NextFunction) { try { res.json({ ok: true, data: await horasAdministrativasService.list(horarioAdministrativoQuerySchema.parse(req.query), user(req)) }); } catch (error) { next(error); } }
export async function listRegistrosAdministrativos(_req: Request, res: Response, next: NextFunction) { try { res.json({ ok: true, data: await horasAdministrativasService.listRecords() }); } catch (error) { next(error); } }
export async function listMisRegistrosAdministrativos(req: Request, res: Response, next: NextFunction) { try { res.json({ ok: true, data: await horasAdministrativasService.listOwnRecords(user(req)) }); } catch (error) { next(error); } }
export async function createHorarioAdministrativo(req: Request, res: Response, next: NextFunction) { try { res.status(201).json({ ok: true, data: await horasAdministrativasService.create(createHorarioAdministrativoSchema.parse(req.body), user(req), ip(req)) }); } catch (error) { next(error); } }
export async function updateHorarioAdministrativo(req: Request, res: Response, next: NextFunction) { try { const { id } = horarioAdministrativoParamsSchema.parse(req.params); res.json({ ok: true, data: await horasAdministrativasService.update(id, updateHorarioAdministrativoSchema.parse(req.body), user(req), ip(req)) }); } catch (error) { next(error); } }
export async function deactivateHorarioAdministrativo(req: Request, res: Response, next: NextFunction) { try { const { id } = horarioAdministrativoParamsSchema.parse(req.params); res.json({ ok: true, data: await horasAdministrativasService.deactivate(id, user(req), ip(req)) }); } catch (error) { next(error); } }
export async function estadoAdministrativoActual(req: Request, res: Response, next: NextFunction) { try { res.json({ ok: true, data: await horasAdministrativasService.estadoActual(user(req)) }); } catch (error) { next(error); } }
export async function marcarEntradaAdministrativa(req: Request, res: Response, next: NextFunction) { try { res.status(201).json({ ok: true, message: 'Ingreso administrativo registrado correctamente.', data: await horasAdministrativasService.marcarEntrada(user(req), locationSchema.parse(req.body), ip(req), req.headers['user-agent']) }); } catch (error) { next(error); } }
export async function marcarSalidaAdministrativa(req: Request, res: Response, next: NextFunction) { try { res.json({ ok: true, message: 'Salida administrativa registrada correctamente.', data: await horasAdministrativasService.marcarSalida(user(req), locationSchema.parse(req.body), ip(req)) }); } catch (error) { next(error); } }
