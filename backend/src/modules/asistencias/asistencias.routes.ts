import { Router } from 'express';
import { Rol } from '@prisma/client';
import { authenticate } from '../../shared/utils/jwt';
import { asistenciaRateLimiter } from '../../shared/middleware/rateLimiter';
import { roleGuard } from '../../shared/middleware/roleGuard';
import {
  aprobarJustificacion,
  getEstadoActual,
  listAsistencias,
  marcarEntrada,
  marcarSalida,
  rechazarJustificacion,
  solicitarJustificacion,
} from './asistencias.controller';

const router = Router();

router.use(authenticate);

router.get('/', roleGuard(Rol.docente, Rol.coordinador, Rol.tics, Rol.rectorado), listAsistencias);
router.get('/estado-actual', roleGuard(Rol.docente), getEstadoActual);
router.post('/entrada', roleGuard(Rol.docente), asistenciaRateLimiter, marcarEntrada);
router.post('/salida', roleGuard(Rol.docente), asistenciaRateLimiter, marcarSalida);
router.post('/:id/justificacion', roleGuard(Rol.docente), solicitarJustificacion);
router.post('/:id/justificacion/aprobar', roleGuard(Rol.coordinador, Rol.tics, Rol.rectorado), aprobarJustificacion);
router.post('/:id/justificacion/rechazar', roleGuard(Rol.coordinador, Rol.tics, Rol.rectorado), rechazarJustificacion);

export default router;
