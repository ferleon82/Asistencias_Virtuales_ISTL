import { Router, type Router as ExpressRouter } from 'express';
import { Rol } from '@prisma/client';
import { authenticate } from '../../shared/utils/jwt';
import { asistenciaRateLimiter } from '../../shared/middleware/rateLimiter';
import { roleGuard } from '../../shared/middleware/roleGuard';
import { createHorarioAdministrativo, deactivateHorarioAdministrativo, estadoAdministrativoActual, listHorariosAdministrativos, listMisRegistrosAdministrativos, listRegistrosAdministrativos, marcarEntradaAdministrativa, marcarSalidaAdministrativa, updateHorarioAdministrativo } from './horas-administrativas.controller';

const router: ExpressRouter = Router();
router.use(authenticate);
router.get('/estado-actual', roleGuard(Rol.docente), estadoAdministrativoActual);
router.post('/entrada', roleGuard(Rol.docente), asistenciaRateLimiter, marcarEntradaAdministrativa);
router.post('/salida', roleGuard(Rol.docente), asistenciaRateLimiter, marcarSalidaAdministrativa);
router.get('/mis-registros', roleGuard(Rol.docente), listMisRegistrosAdministrativos);
router.get('/registros', roleGuard(Rol.talento_humano, Rol.tics), listRegistrosAdministrativos);
router.get('/', roleGuard(Rol.docente, Rol.talento_humano, Rol.tics), listHorariosAdministrativos);
router.post('/', roleGuard(Rol.talento_humano, Rol.tics), createHorarioAdministrativo);
router.put('/:id', roleGuard(Rol.talento_humano, Rol.tics), updateHorarioAdministrativo);
router.delete('/:id', roleGuard(Rol.talento_humano, Rol.tics), deactivateHorarioAdministrativo);
export default router;
