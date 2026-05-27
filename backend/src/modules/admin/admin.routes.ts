import { Router, type Router as ExpressRouter } from 'express';
import { Rol } from '@prisma/client';
import { authenticate } from '../../shared/utils/jwt';
import { roleGuard } from '../../shared/middleware/roleGuard';
import {
  createCarrera,
  createMateria,
  createPeriodoAcademico,
  createUsuario,
  deactivateCarrera,
  deactivateMateria,
  deactivatePeriodoAcademico,
  listCarreras,
  listDocentes,
  listMaterias,
  listPeriodosAcademicos,
  listUsuarios,
  updateCarrera,
  updateMateria,
  updatePeriodoAcademico,
  updateUsuario,
} from './admin.controller';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get(
  '/periodos-academicos',
  roleGuard(Rol.docente, Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano),
  listPeriodosAcademicos
);

router.use(roleGuard(Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano));

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

router.post('/periodos-academicos', createPeriodoAcademico);
router.put('/periodos-academicos/:id', updatePeriodoAcademico);
router.delete('/periodos-academicos/:id', deactivatePeriodoAcademico);

router.get('/docentes', listDocentes);

export default router;
