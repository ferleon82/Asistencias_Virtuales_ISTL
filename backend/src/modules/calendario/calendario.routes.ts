import { Router, type Router as ExpressRouter } from 'express';
import { Rol } from '@prisma/client';
import { authenticate } from '../../shared/utils/jwt';
import { roleGuard } from '../../shared/middleware/roleGuard';
import { createDiasNoLaborables, deleteDiaNoLaborable, listDiasNoLaborables } from './calendario.controller';

const router: ExpressRouter = Router();

router.use(authenticate);

// Todos los roles pueden consultar el calendario; lo administran Talento Humano y TICs.
const canRead = roleGuard(Rol.docente, Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano);
const canManage = roleGuard(Rol.talento_humano, Rol.tics);

router.get('/dias-no-laborables', canRead, listDiasNoLaborables);
router.post('/dias-no-laborables', canManage, createDiasNoLaborables);
router.delete('/dias-no-laborables/:id', canManage, deleteDiaNoLaborable);

export default router;
