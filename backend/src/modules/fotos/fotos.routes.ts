import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { AppError } from '../../shared/middleware/errorHandler';
import { verifyPhotoSignature } from '../../shared/attendance/photoUrls';
import { getPhotoStorage } from '../../shared/storage/photoStorage';

const router: ExpressRouter = Router();

/**
 * GET /fotos/:archivo?exp=&sig=
 * Entrega una foto de asistencia. No usa el token de sesión porque se abre
 * como enlace en una pestaña nueva o desde el Excel: la autorización es la
 * firma, que solo emiten las consultas filtradas por rol.
 */
router.get('/:archivo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { archivo } = req.params;
    if (!verifyPhotoSignature(archivo, req.query.exp, req.query.sig)) {
      throw new AppError('El enlace de la foto no es válido o ya venció. Vuelva a abrir el reporte.', 403);
    }

    const foto = await getPhotoStorage().read(archivo);
    if (!foto) {
      throw new AppError('La foto ya no está disponible.', 404);
    }

    res.setHeader('Content-Type', archivo.endsWith('.png') ? 'image/png' : 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(foto);
  } catch (error) {
    next(error);
  }
});

export default router;
