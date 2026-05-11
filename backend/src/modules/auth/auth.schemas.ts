import { z } from 'zod';

// ─── Login ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .refine((email) => email.endsWith('@tecnologicoloja.edu.ec'), {
      message: 'Debe usar su correo institucional (@tecnologicoloja.edu.ec)',
    }),
  password: z
    .string()
    .min(8, 'La contraseña debe tener mínimo 8 caracteres'),
});

// ─── Refresh Token ─────────────────────────────────────────────────────────────
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'El refresh token es requerido'),
});

// ─── Cambio de Contraseña ──────────────────────────────────────────────────────
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z
      .string()
      .min(8, 'La nueva contraseña debe tener mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

// ─── Types inferidos ───────────────────────────────────────────────────────────
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
