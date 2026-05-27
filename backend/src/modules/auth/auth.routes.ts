import { Router, type Router as ExpressRouter } from 'express';
import { changePassword, getMe, googleCallback, googleLogin, login, logout, refreshToken } from './auth.controller';
import { authenticate } from '../../shared/utils/jwt';
import { loginRateLimiter } from '../../shared/middleware/rateLimiter';

const router: ExpressRouter = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Autenticación]
 *     summary: Iniciar sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jdoe@tecnologicoloja.edu.ec
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales incorrectas
 *       429:
 *         description: Demasiados intentos
 */
router.post('/login', loginRateLimiter, login);
router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Autenticación]
 *     summary: Renovar access token
 */
router.post('/refresh', refreshToken);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Autenticación]
 *     summary: Cerrar sesión (requiere autenticación)
 *     security:
 *       - bearerAuth: []
 */
router.post('/logout', authenticate, logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Autenticación]
 *     summary: Obtener perfil del usuario autenticado
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', authenticate, getMe);

/**
 * @openapi
 * /auth/change-password:
 *   put:
 *     tags: [Autenticación]
 *     summary: Cambiar contraseña (requiere autenticación)
 *     security:
 *       - bearerAuth: []
 */
router.put('/change-password', authenticate, changePassword);

export default router;
