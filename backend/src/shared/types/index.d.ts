import { Rol } from '@prisma/client';

// ─── Extensiones de tipos Express ──────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        rol: string;
      };
    }
  }
}

// ─── Tipos de respuesta estándar de la API ─────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean;
  message?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  ok: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Tipos de usuario autenticado ──────────────────────────────────────────────

export interface AuthenticatedUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  avatar_url: string | null;
}

// ─── Tipos de filtros de reportes ──────────────────────────────────────────────

export interface ReporteFilters {
  carrera_id?: string;
  docente_id?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  ciclo?: string;
  estado?: string;
}

// ─── Tipos de JWT Payload ───────────────────────────────────────────────────────

export interface JwtTokenPayload {
  sub: string;
  email: string;
  rol: Rol;
  iat?: number;
  exp?: number;
}

export {};
