import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/middleware/errorHandler';
import { adminService } from './admin.service';
import {
  carreraSchema,
  createUsuarioSchema,
  idParamsSchema,
  materiaSchema,
  modulePermissionsSchema,
  periodoAcademicoSchema,
  systemSettingsSchema,
  updatePeriodoAcademicoSchema,
  updateUsuarioSchema,
} from './admin.schemas';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function requireUser(req: Request) {
  if (!req.user) throw new AppError('Autenticación requerida.', 401);
  return req.user;
}

export async function listCarreras(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listCarreras(requireUser(req));
    res.status(200).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listUsuarios(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listUsuarios(requireUser(req));
    res.status(200).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = createUsuarioSchema.parse(req.body);
    const data = await adminService.createUsuario(payload, requireUser(req), getClientIp(req));
    res.status(201).json({ ok: true, message: 'Usuario creado correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function updateUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const payload = updateUsuarioSchema.parse(req.body);
    const data = await adminService.updateUsuario(id, payload, requireUser(req), getClientIp(req));
    res.status(200).json({ ok: true, message: 'Usuario actualizado correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function createCarrera(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = carreraSchema.parse(req.body);
    const data = await adminService.createCarrera(payload, requireUser(req), getClientIp(req));
    res.status(201).json({ ok: true, message: 'Carrera creada correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function updateCarrera(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const payload = carreraSchema.partial().parse(req.body);
    const data = await adminService.updateCarrera(id, payload, requireUser(req), getClientIp(req));
    res.status(200).json({ ok: true, message: 'Carrera actualizada correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function deactivateCarrera(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = await adminService.deactivateCarrera(id, requireUser(req), getClientIp(req));
    res.status(200).json({ ok: true, message: 'Carrera eliminada correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function listMaterias(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listMaterias(requireUser(req));
    res.status(200).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listPeriodosAcademicos(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listPeriodosAcademicos();
    res.status(200).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createPeriodoAcademico(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = periodoAcademicoSchema.parse(req.body);
    const data = await adminService.createPeriodoAcademico(payload, requireUser(req), getClientIp(req));
    res.status(201).json({ ok: true, message: 'Período académico creado correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function updatePeriodoAcademico(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const payload = updatePeriodoAcademicoSchema.parse(req.body);
    const data = await adminService.updatePeriodoAcademico(id, payload, requireUser(req), getClientIp(req));
    res.status(200).json({ ok: true, message: 'Período académico actualizado correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function deactivatePeriodoAcademico(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = await adminService.deactivatePeriodoAcademico(id, requireUser(req), getClientIp(req));
    res.status(200).json({ ok: true, message: 'Período académico desactivado correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function createMateria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = materiaSchema.parse(req.body);
    const data = await adminService.createMateria(payload, requireUser(req), getClientIp(req));
    res.status(201).json({ ok: true, message: 'Materia creada correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function updateMateria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const payload = materiaSchema.partial().parse(req.body);
    const data = await adminService.updateMateria(id, payload, requireUser(req), getClientIp(req));
    res.status(200).json({ ok: true, message: 'Materia actualizada correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function deactivateMateria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = await adminService.deactivateMateria(id, requireUser(req), getClientIp(req));
    res.status(200).json({ ok: true, message: 'Materia eliminada correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function listDocentes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listDocentes();
    res.status(200).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listModulePermissions(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listModulePermissions();
    res.status(200).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listCurrentModulePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listCurrentModulePermissions(requireUser(req));
    res.status(200).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateModulePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = modulePermissionsSchema.parse(req.body);
    const data = await adminService.updateModulePermissions(payload, requireUser(req), getClientIp(req));
    res.status(200).json({ ok: true, message: 'Configuración de módulos actualizada correctamente.', data });
  } catch (error) {
    next(error);
  }
}

export async function listSystemSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listSystemSettings();
    res.status(200).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateSystemSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = systemSettingsSchema.parse(req.body);
    const data = await adminService.updateSystemSettings(payload, requireUser(req), getClientIp(req));
    res.status(200).json({ ok: true, message: 'Configuración del sistema actualizada correctamente.', data });
  } catch (error) {
    next(error);
  }
}
