import { Router, type Router as ExpressRouter } from 'express';
import { Rol } from '@prisma/client';
import { authenticate } from '../../shared/utils/jwt';
import { roleGuard } from '../../shared/middleware/roleGuard';
import {
  createHorario,
  deactivateHorario,
  getHorario,
  listHorarios,
  updateHorario,
} from './horarios.controller';

const router: ExpressRouter = Router();

const canReadHorarios = roleGuard(Rol.docente, Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano);
const canManageHorarios = roleGuard(Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano);

router.use(authenticate);

router.get('/', canReadHorarios, listHorarios);
router.get('/:id', canReadHorarios, getHorario);
router.post('/', canManageHorarios, createHorario);
router.put('/:id', canManageHorarios, updateHorario);
router.delete('/:id', canManageHorarios, deactivateHorario);

export default router;
