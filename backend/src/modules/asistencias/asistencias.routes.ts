import { Router, type Router as ExpressRouter } from 'express';
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
  solicitarJustificacionHorario,
} from './asistencias.controller';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get('/', roleGuard(Rol.docente, Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano), listAsistencias);
router.get('/estado-actual', roleGuard(Rol.docente), getEstadoActual);
router.post('/entrada', roleGuard(Rol.docente), asistenciaRateLimiter, marcarEntrada);
router.post('/salida', roleGuard(Rol.docente), asistenciaRateLimiter, marcarSalida);
router.post('/horario/:horarioId/justificacion', roleGuard(Rol.docente), solicitarJustificacionHorario);
router.post('/:id/justificacion', roleGuard(Rol.docente), solicitarJustificacion);
router.post('/:id/justificacion/aprobar', roleGuard(Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano), aprobarJustificacion);
router.post('/:id/justificacion/rechazar', roleGuard(Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano), rechazarJustificacion);

export default router;
