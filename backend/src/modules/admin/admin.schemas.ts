import { z } from 'zod';
import { Rol } from '@prisma/client';

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional()
);

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula')
  .regex(/[0-9]/, 'La contraseña debe incluir un número');

export const carreraSchema = z.object({
  nombre: z.string().trim().min(3, 'Nombre requerido').max(120),
  codigo: z.string().trim().min(2, 'Código requerido').max(20).toUpperCase(),
  coordinador_id: z.string().uuid().nullable().optional(),
  activa: z.boolean().default(true),
});

export const materiaSchema = z.object({
  nombre: z.string().trim().min(3, 'Nombre requerido').max(140),
  codigo: z.string().trim().min(2, 'Código requerido').max(30).toUpperCase(),
  carrera_id: z.string().uuid('Carrera requerida'),
  docente_id: z.string().uuid().nullable().optional(),
  ciclo: z.coerce.number().int().min(1, 'Ciclo requerido').max(5, 'El ciclo debe estar entre 1 y 5'),
  creditos: z.coerce.number().int().min(1).max(12).default(3),
  activa: z.boolean().default(true),
});

const periodoAcademicoBaseSchema = z.object({
  nombre: z.string().trim().min(3, 'Nombre requerido').max(120),
  codigo: z.string().trim().min(2, 'Código requerido').max(30).toUpperCase(),
  fecha_inicio: z.coerce.date(),
  fecha_fin: z.coerce.date(),
  activo: z.boolean().default(true),
});

export const periodoAcademicoSchema = periodoAcademicoBaseSchema
  .refine((data) => data.fecha_inicio <= data.fecha_fin, {
    message: 'La fecha de inicio debe ser anterior o igual a la fecha fin',
    path: ['fecha_fin'],
  });

export const updatePeriodoAcademicoSchema = periodoAcademicoBaseSchema
  .partial()
  .refine((data) => !data.fecha_inicio || !data.fecha_fin || data.fecha_inicio <= data.fecha_fin, {
    message: 'La fecha de inicio debe ser anterior o igual a la fecha fin',
    path: ['fecha_fin'],
  });

export const idParamsSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export const createUsuarioSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .toLowerCase()
    .refine((email) => email.endsWith('@tecnologicoloja.edu.ec'), {
      message: 'Debe usar un correo institucional @tecnologicoloja.edu.ec',
    }),
  nombre: z.string().trim().min(2, 'Nombre requerido').max(80),
  apellido: z.string().trim().min(2, 'Apellido requerido').max(80),
  cedula: z.string().trim().min(10, 'Cédula requerida').max(20),
  password: passwordSchema,
  rol: z.nativeEnum(Rol).default(Rol.docente),
  telefono: optionalText,
  activo: z.boolean().default(true),
});

export const updateUsuarioSchema = createUsuarioSchema
  .omit({ password: true })
  .partial()
  .extend({
    password: passwordSchema.optional(),
  });

export const modulePermissionSchema = z.object({
  module_key: z.string().trim().min(2).max(80),
  rol: z.nativeEnum(Rol),
  enabled: z.boolean(),
});

export const modulePermissionsSchema = z.object({
  permissions: z.array(modulePermissionSchema).min(1),
});

export const systemSettingsSchema = z.object({
  attendance_photo_required: z.boolean(),
});

export type CarreraInput = z.infer<typeof carreraSchema>;
export type MateriaInput = z.infer<typeof materiaSchema>;
export type PeriodoAcademicoInput = z.infer<typeof periodoAcademicoSchema>;
export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>;
export type UpdateUsuarioInput = z.infer<typeof updateUsuarioSchema>;
export type ModulePermissionsInput = z.infer<typeof modulePermissionsSchema>;
export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
