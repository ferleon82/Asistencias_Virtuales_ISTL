import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/middleware/errorHandler';
import { reporteQuerySchema } from './reportes.schemas';
import { reportesService } from './reportes.service';

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError('Autenticacion requerida.', 401);
  }
  return req.user;
}

function filename(prefix: string, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.${extension}`;
}

export async function getResumenReporte(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = reporteQuerySchema.parse(req.query);
    const data = await reportesService.resumen(filters, requireUser(req));

    res.status(200).json({
      ok: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadExcelReporte(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = reporteQuerySchema.parse(req.query);
    const buffer = await reportesService.excel(filters, requireUser(req));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename('reporte-asistencias', 'xlsx')}"`);
    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function downloadPdfReporte(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = reporteQuerySchema.parse(req.query);
    const buffer = await reportesService.pdf(filters, requireUser(req));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename('reporte-asistencias', 'pdf')}"`);
    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}
