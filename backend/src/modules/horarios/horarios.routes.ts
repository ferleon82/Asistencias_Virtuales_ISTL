import { Router } from 'express';
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

const router = Router();

const canReadHorarios = roleGuard(Rol.docente, Rol.coordinador, Rol.tics, Rol.rectorado);
const canManageHorarios = roleGuard(Rol.coordinador, Rol.tics, Rol.rectorado);

router.use(authenticate);

router.get('/', canReadHorarios, listHorarios);
router.get('/:id', canReadHorarios, getHorario);
router.post('/', canManageHorarios, createHorario);
router.put('/:id', canManageHorarios, updateHorario);
router.delete('/:id', canManageHorarios, deactivateHorario);

export default router;
