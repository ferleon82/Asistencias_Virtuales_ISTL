import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { authService } from './auth.service';
import { loginSchema, refreshTokenSchema, changePasswordSchema } from './auth.schemas';
import { AppError } from '../../shared/middleware/errorHandler';
import { prisma } from '../../config/database';
import { AuthService } from './auth.service';
import { env } from '../../config/env';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function googleEnabled(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;

  return raw
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

function googleErrorRedirect(message: string): string {
  const params = new URLSearchParams({ error: message });
  return `${env.FRONTEND_URL}/login?${params.toString()}`;
}

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
  hd?: string;
}

// ─── Controladores ──────────────────────────────────────────────────────────────

/**
 * POST /auth/login
 * Autentica al usuario y devuelve access + refresh token.
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = loginSchema.safeParse(req.body);
    if (!validated.success) {
      throw new AppError(
        validated.error.errors.map((e) => e.message).join('. '),
        400
      );
    }

    const ip = getClientIp(req);
    const result = await authService.login(validated.data, ip);

    res.status(200).json({
      ok: true,
      message: `Bienvenido/a, ${result.user.nombre}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function googleLogin(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!googleEnabled()) {
      res.redirect(googleErrorRedirect('Inicio con Google no configurado.'));
      return;
    }

    const state = randomUUID();
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      hd: env.GOOGLE_ALLOWED_DOMAIN,
      state,
    });

    res.setHeader('Set-Cookie', `google_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=600`);
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (error) {
    next(error);
  }
}

export async function googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!googleEnabled()) {
      res.redirect(googleErrorRedirect('Inicio con Google no configurado.'));
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const cookieState = readCookie(req, 'google_oauth_state');

    res.setHeader('Set-Cookie', 'google_oauth_state=; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=0');

    if (!code || !state || state !== cookieState) {
      res.redirect(googleErrorRedirect('No se pudo validar la solicitud de Google.'));
      return;
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      res.redirect(googleErrorRedirect('Google no pudo validar sus credenciales.'));
      return;
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      res.redirect(googleErrorRedirect('Google no devolvió un token válido.'));
      return;
    }

    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      res.redirect(googleErrorRedirect('No se pudo obtener el perfil institucional.'));
      return;
    }

    const googleUser = (await userInfoResponse.json()) as GoogleUserInfo;
    const email = googleUser.email?.toLowerCase();
    const allowedDomain = env.GOOGLE_ALLOWED_DOMAIN.toLowerCase();

    if (!email || !googleUser.email_verified || !email.endsWith(`@${allowedDomain}`)) {
      res.redirect(googleErrorRedirect('Debe usar una cuenta institucional verificada.'));
      return;
    }

    const result = await authService.loginWithInstitutionalEmail(email, getClientIp(req));
    const fragment = new URLSearchParams({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });

    res.redirect(`${env.FRONTEND_URL}/login#${fragment.toString()}`);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/refresh
 * Renueva el access token usando el refresh token.
 */
export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = refreshTokenSchema.safeParse(req.body);
    if (!validated.success) {
      throw new AppError('Refresh token requerido.', 400);
    }

    const ip = getClientIp(req);
    const tokens = await authService.refreshTokens(validated.data.refreshToken, ip);

    res.status(200).json({
      ok: true,
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/logout
 * Cierra la sesión del usuario autenticado.
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = refreshTokenSchema.safeParse(req.body);
    if (!validated.success) {
      throw new AppError('Refresh token requerido para cerrar sesión.', 400);
    }

    const ip = getClientIp(req);
    const userId = req.user!.id;

    await authService.logout(validated.data.refreshToken, userId, ip);

    res.status(200).json({
      ok: true,
      message: 'Sesión cerrada correctamente.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/me
 * Devuelve el perfil del usuario autenticado.
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.id);
    res.status(200).json({ ok: true, data: user });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /auth/change-password
 * Permite al usuario cambiar su propia contraseña.
 */
export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = changePasswordSchema.safeParse(req.body);
    if (!validated.success) {
      throw new AppError(
        validated.error.errors.map((e) => e.message).join('. '),
        400
      );
    }

    const userId = req.user!.id;

    // Verificar contraseña actual
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password_hash: true },
    });

    if (!user) throw new AppError('Usuario no encontrado.', 404);

    const { default: bcrypt } = await import('bcryptjs');
    const valid = await bcrypt.compare(validated.data.currentPassword, user.password_hash);
    if (!valid) throw new AppError('La contraseña actual es incorrecta.', 400);

    // Actualizar contraseña
    const newHash = await AuthService.hashPassword(validated.data.newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHash },
    });

    // Revocar todos los refresh tokens (forzar re-login en todos los dispositivos)
    await prisma.refreshToken.updateMany({
      where: { user_id: userId, revocado: false },
      data: { revocado: true },
    });

    res.status(200).json({
      ok: true,
      message: 'Contraseña actualizada. Por seguridad, inicie sesión nuevamente.',
    });
  } catch (error) {
    next(error);
  }
}
