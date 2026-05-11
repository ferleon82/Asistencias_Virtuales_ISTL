import { z } from 'zod';
import { Rol } from '@prisma/client';

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional()
);

const passwordSchema = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'La contrasena debe incluir una mayuscula')
  .regex(/[0-9]/, 'La contrasena debe incluir un numero');

export const carreraSchema = z.object({
  nombre: z.string().trim().min(3, 'Nombre requerido').max(120),
  codigo: z.string().trim().min(2, 'Codigo requerido').max(20).toUpperCase(),
  coordinador_id: z.string().uuid().nullable().optional(),
  activa: z.boolean().default(true),
});

export const materiaSchema = z.object({
  nombre: z.string().trim().min(3, 'Nombre requerido').max(140),
  codigo: z.string().trim().min(2, 'Codigo requerido').max(30).toUpperCase(),
  carrera_id: z.string().uuid('Carrera requerida'),
  docente_id: z.string().uuid().nullable().optional(),
  creditos: z.coerce.number().int().min(1).max(12).default(3),
  activa: z.boolean().default(true),
});

export const idParamsSchema = z.object({
  id: z.string().uuid('ID invalido'),
});

export const createUsuarioSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Email invalido')
    .toLowerCase()
    .refine((email) => email.endsWith('@tecnologicoloja.edu.ec'), {
      message: 'Debe usar un correo institucional @tecnologicoloja.edu.ec',
    }),
  nombre: z.string().trim().min(2, 'Nombre requerido').max(80),
  apellido: z.string().trim().min(2, 'Apellido requerido').max(80),
  cedula: z.string().trim().min(10, 'Cedula requerida').max(20),
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

export type CarreraInput = z.infer<typeof carreraSchema>;
export type MateriaInput = z.infer<typeof materiaSchema>;
export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>;
export type UpdateUsuarioInput = z.infer<typeof updateUsuarioSchema>;
