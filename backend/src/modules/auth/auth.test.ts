import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service';
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../../shared/utils/jwt';
import { AppError } from '../../shared/middleware/errorHandler';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

// Mock Prisma
vi.mock('../../config/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock Redis
vi.mock('../../config/redis', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
}));

// Mock env
vi.mock('../../config/env', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test_access_secret_32chars_minimum_ok',
    JWT_REFRESH_SECRET: 'test_refresh_secret_32chars_minimum_ok',
    JWT_ACCESS_EXPIRY: '8h',
    JWT_REFRESH_EXPIRY: '7d',
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://test',
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX: 5,
    FRONTEND_URL: 'http://localhost:5173',
    GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/v1/auth/google/callback',
    GOOGLE_ALLOWED_DOMAIN: 'tecnologicoloja.edu.ec',
  },
}));

import { prisma } from '../../config/database';

// ─── Datos de prueba ───────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-uuid-1234',
  email: 'jdoe@tecnologicoloja.edu.ec',
  nombre: 'Juan',
  apellido: 'Doe',
  rol: 'docente' as const,
  avatar_url: null,
  password_hash: '$2a$12$hashedpassword', // bcrypt hash de "Password123"
  activo: true,
};

// ─── Tests de JWT utils ─────────────────────────────────────────────────────────

describe('JWT Utils', () => {
  const payload = { sub: 'user-1', email: 'test@tecnologicoloja.edu.ec', rol: 'docente' };

  describe('generateAccessToken', () => {
    it('genera un token JWT válido', () => {
      const token = generateAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // Header.Payload.Signature
    });

    it('el token contiene el payload correcto', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.rol).toBe(payload.rol);
    });
  });

  describe('generateRefreshToken', () => {
    it('genera un refresh token diferente al access token', () => {
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);
      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('verifica correctamente un token válido', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
    });

    it('lanza AppError con token inválido', () => {
      expect(() => verifyAccessToken('token.invalido.aqui')).toThrow(AppError);
    });

    it('lanza AppError con token manipulado', () => {
      const token = generateAccessToken(payload);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyAccessToken(tampered)).toThrow(AppError);
    });

    it('rechaza un refresh token en lugar de access token', () => {
      // El refresh token fue firmado con una clave diferente
      const refreshToken = generateRefreshToken(payload);
      expect(() => verifyAccessToken(refreshToken)).toThrow(AppError);
    });
  });
});

// ─── Tests de Auth Schemas ──────────────────────────────────────────────────────

describe('Auth Schemas', async () => {
  const { loginSchema } = await import('./auth.schemas');

  describe('loginSchema', () => {
    it('acepta credenciales institucionales válidas', () => {
      const result = loginSchema.safeParse({
        email: 'jdoe@tecnologicoloja.edu.ec',
        password: 'Password123',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza correos no institucionales', () => {
      const result = loginSchema.safeParse({
        email: 'jdoe@gmail.com',
        password: 'Password123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('@tecnologicoloja.edu.ec');
      }
    });

    it('rechaza contraseñas de menos de 8 caracteres', () => {
      const result = loginSchema.safeParse({
        email: 'jdoe@tecnologicoloja.edu.ec',
        password: '123',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza email con formato inválido', () => {
      const result = loginSchema.safeParse({
        email: 'no-es-un-email',
        password: 'Password123',
      });
      expect(result.success).toBe(false);
    });
  });
});

// ─── Tests de AuthService ───────────────────────────────────────────────────────

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('lanza AppError si el usuario no existe', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        authService.login({ email: 'noexiste@tecnologicoloja.edu.ec', password: 'Password123' }, '127.0.0.1')
      ).rejects.toThrow(AppError);
    });

    it('lanza AppError si la cuenta está desactivada', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        activo: false,
      });

      await expect(
        authService.login({ email: mockUser.email, password: 'Password123' }, '127.0.0.1')
      ).rejects.toThrow(AppError);
    });

    it('lanza AppError con contraseña incorrecta', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      await expect(
        authService.login({ email: mockUser.email, password: 'WrongPassword1' }, '127.0.0.1')
      ).rejects.toThrow(AppError);
    });

    it('no revela si el usuario existe (mismo mensaje de error)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      let errorMessage1 = '';
      try {
        await authService.login({ email: 'noexiste@tecnologicoloja.edu.ec', password: 'Password123' }, '127.0.0.1');
      } catch (e) {
        if (e instanceof AppError) errorMessage1 = e.message;
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      let errorMessage2 = '';
      try {
        await authService.login({ email: mockUser.email, password: 'WrongPassword1' }, '127.0.0.1');
      } catch (e) {
        if (e instanceof AppError) errorMessage2 = e.message;
      }

      // El mensaje debe ser idéntico (no revelar si el usuario existe)
      expect(errorMessage1).toBe(errorMessage2);
    });
  });

  describe('hashPassword', () => {
    it('genera un hash bcrypt válido', async () => {
      const hash = await AuthService.hashPassword('Password123');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('Password123');
      expect(hash.startsWith('$2a$')).toBe(true);
    });

    it('genera hashes diferentes para la misma contraseña (salt)', async () => {
      const hash1 = await AuthService.hashPassword('Password123');
      const hash2 = await AuthService.hashPassword('Password123');
      expect(hash1).not.toBe(hash2);
    });
  });
});

// ─── Tests de AppError ─────────────────────────────────────────────────────────

describe('AppError', () => {
  it('crea un error con statusCode correcto', () => {
    const error = new AppError('Error de prueba', 404);
    expect(error.message).toBe('Error de prueba');
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
  });

  it('es una instancia de Error', () => {
    const error = new AppError('Test', 500);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });
});
