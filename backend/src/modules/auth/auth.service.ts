import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { cacheDel, cacheGet, cacheSet } from '../../config/redis';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../shared/utils/jwt';
import { AppError } from '../../shared/middleware/errorHandler';
import type { LoginInput } from './auth.schemas';
import type { Rol } from '@prisma/client';

// ─── Tipos de respuesta ─────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  avatar_url: string | null;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

// ─── Servicio de Autenticación ─────────────────────────────────────────────────

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly USER_CACHE_PREFIX = 'cache:user:';
  private static readonly USER_CACHE_TTL = 300; // 5 minutos

  /**
   * Autentica un docente/coordinador con email y contraseña.
   * Registra el último acceso y el refresh token en BD.
   */
  async login(data: LoginInput, ip: string): Promise<LoginResponse> {
    // 1. Buscar usuario por email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        avatar_url: true,
        password_hash: true,
        activo: true,
      },
    });

    // Mismo mensaje para usuario no encontrado o contraseña incorrecta (evitar enumeración)
    const invalidCredentialsError = new AppError(
      'Credenciales incorrectas. Verifique su email y contraseña.',
      401
    );

    if (!user) throw invalidCredentialsError;

    if (!user.activo) {
      throw new AppError('Su cuenta está desactivada. Contacte al área de TICs.', 403);
    }

    // 2. Verificar contraseña
    const passwordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!passwordValid) throw invalidCredentialsError;

    // 3. Generar tokens
    const payload = { sub: user.id, email: user.email, rol: user.rol };
    const accessToken = generateAccessToken(payload);
    const refreshTokenValue = generateRefreshToken(payload);

    // 4. Guardar refresh token en BD
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token: refreshTokenValue,
        expires_at: expiresAt,
        ip,
      },
    });

    // 5. Actualizar último acceso
    await prisma.user.update({
      where: { id: user.id },
      data: { ultimo_acceso: new Date() },
    });

    // 6. Registrar en auditoría
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        accion: 'LOGIN',
        tabla_afectada: 'users',
        registro_id: user.id,
        ip,
        datos_nuevos: { email: user.email, rol: user.rol },
      },
    });

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      apellido: user.apellido,
      rol: user.rol,
      avatar_url: user.avatar_url,
    };

    // Invalidar caché de usuario si existía
    await cacheDel(`${AuthService.USER_CACHE_PREFIX}${user.id}`);

    return {
      user: authUser,
      tokens: {
        accessToken,
        refreshToken: refreshTokenValue,
      },
    };
  }

  /**
   * Renueva el access token a partir de un refresh token válido.
   */
  async loginWithInstitutionalEmail(email: string, ip: string): Promise<LoginResponse> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        avatar_url: true,
        activo: true,
      },
    });

    if (!user) {
      throw new AppError('Usuario institucional no registrado en la plataforma.', 403);
    }

    if (!user.activo) {
      throw new AppError('Su cuenta está desactivada. Contacte al área de TICs.', 403);
    }

    const payload = { sub: user.id, email: user.email, rol: user.rol };
    const accessToken = generateAccessToken(payload);
    const refreshTokenValue = generateRefreshToken(payload);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token: refreshTokenValue,
        expires_at: expiresAt,
        ip,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { ultimo_acceso: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        accion: 'LOGIN_GOOGLE',
        tabla_afectada: 'users',
        registro_id: user.id,
        ip,
        datos_nuevos: { email: user.email, rol: user.rol },
      },
    });

    await cacheDel(`${AuthService.USER_CACHE_PREFIX}${user.id}`);

    return {
      user,
      tokens: {
        accessToken,
        refreshToken: refreshTokenValue,
      },
    };
  }

  async refreshTokens(refreshTokenValue: string, ip: string): Promise<AuthTokens> {
    // 1. Verificar token JWT
    verifyRefreshToken(refreshTokenValue);

    // 2. Verificar que existe en BD y no está revocado
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
      include: {
        usuario: {
          select: { id: true, email: true, rol: true, activo: true },
        },
      },
    });

    if (!storedToken || storedToken.revocado) {
      throw new AppError('Token de sesión inválido o revocado.', 401);
    }

    if (storedToken.expires_at < new Date()) {
      throw new AppError('La sesión ha expirado. Inicie sesión nuevamente.', 401);
    }

    if (!storedToken.usuario.activo) {
      throw new AppError('Cuenta desactivada. Contacte al área de TICs.', 403);
    }

    // 3. Rotar refresh token (invalidar el anterior, generar uno nuevo)
    const newPayload = {
      sub: storedToken.usuario.id,
      email: storedToken.usuario.email,
      rol: storedToken.usuario.rol,
    };

    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    // Transacción: revocar viejo + crear nuevo
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revocado: true },
      }),
      prisma.refreshToken.create({
        data: {
          user_id: storedToken.usuario.id,
          token: newRefreshToken,
          expires_at: newExpiresAt,
          ip,
        },
      }),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Cierra la sesión del usuario revocando el refresh token.
   */
  async logout(refreshTokenValue: string, userId: string, ip: string): Promise<void> {
    // Revocar en BD
    await prisma.refreshToken.updateMany({
      where: {
        token: refreshTokenValue,
        user_id: userId,
        revocado: false,
      },
      data: { revocado: true },
    });

    // Limpiar caché del usuario
    await cacheDel(`${AuthService.USER_CACHE_PREFIX}${userId}`);

    // Auditoría
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        accion: 'LOGOUT',
        tabla_afectada: 'refresh_tokens',
        ip,
      },
    });
  }

  /**
   * Obtiene el perfil del usuario autenticado (con caché Redis).
   */
  async getMe(userId: string): Promise<AuthUser> {
    const cacheKey = `${AuthService.USER_CACHE_PREFIX}${userId}`;

    // Intentar desde caché
    const cached = await cacheGet<AuthUser>(cacheKey);
    if (cached) return cached;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        avatar_url: true,
        activo: true,
      },
    });

    if (!user || !user.activo) {
      throw new AppError('Usuario no encontrado o inactivo.', 404);
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      apellido: user.apellido,
      rol: user.rol,
      avatar_url: user.avatar_url,
    };

    // Guardar en caché
    await cacheSet(cacheKey, authUser, AuthService.USER_CACHE_TTL);

    return authUser;
  }

  /**
   * Hash seguro de contraseña.
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, AuthService.SALT_ROUNDS);
  }
}

export const authService = new AuthService();
