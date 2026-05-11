import { Router } from 'express';
import { Rol } from '@prisma/client';
import { authenticate } from '../../shared/utils/jwt';
import { roleGuard } from '../../shared/middleware/roleGuard';
import { downloadExcelReporte, downloadPdfReporte, getResumenReporte } from './reportes.controller';

const router = Router();

router.use(authenticate);
router.use(roleGuard(Rol.docente, Rol.coordinador, Rol.tics, Rol.rectorado));

router.get('/resumen', getResumenReporte);
router.get('/excel', downloadExcelReporte);
router.get('/pdf', downloadPdfReporte);

export default router;
