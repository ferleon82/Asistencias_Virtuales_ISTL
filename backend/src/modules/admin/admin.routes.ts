import { Router } from 'express';
import { Rol } from '@prisma/client';
import { authenticate } from '../../shared/utils/jwt';
import { roleGuard } from '../../shared/middleware/roleGuard';
import {
  createCarrera,
  createMateria,
  createUsuario,
  deactivateCarrera,
  deactivateMateria,
  listCarreras,
  listDocentes,
  listMaterias,
  listUsuarios,
  updateCarrera,
  updateMateria,
  updateUsuario,
} from './admin.controller';

const router = Router();

router.use(authenticate);
router.use(roleGuard(Rol.coordinador, Rol.tics, Rol.rectorado));

router.get('/usuarios', listUsuarios);
router.post('/usuarios', createUsuario);
router.put('/usuarios/:id', updateUsuario);

router.get('/carreras', listCarreras);
router.post('/carreras', createCarrera);
router.put('/carreras/:id', updateCarrera);
router.delete('/carreras/:id', deactivateCarrera);

router.get('/materias', listMaterias);
router.post('/materias', createMateria);
router.put('/materias/:id', updateMateria);
router.delete('/materias/:id', deactivateMateria);

router.get('/docentes', listDocentes);

export default router;
