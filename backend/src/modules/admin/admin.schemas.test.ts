import { describe, expect, it } from 'vitest';
import { carreraSchema, createUsuarioSchema, materiaSchema, updateUsuarioSchema } from './admin.schemas';

describe('admin schemas', () => {
  it('normaliza codigos de carrera a mayusculas', () => {
    const result = carreraSchema.safeParse({
      nombre: 'Tecnologia Superior en Desarrollo de Software',
      codigo: 'ds',
      activa: true,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.codigo).toBe('DS');
  });

  it('permite carrera sin coordinador en actualizacion', () => {
    const result = carreraSchema.partial().safeParse({
      coordinador_id: null,
    });

    expect(result.success).toBe(true);
  });

  it('valida materia con docente opcional', () => {
    const result = materiaSchema.safeParse({
      nombre: 'Programacion Web',
      codigo: 'pw-101',
      carrera_id: '11111111-1111-4111-8111-111111111111',
      docente_id: null,
      ciclo: 2,
      creditos: 4,
      activa: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.codigo).toBe('PW-101');
      expect(result.data.ciclo).toBe(2);
    }
  });

  it('rechaza materia fuera del rango de ciclos', () => {
    const result = materiaSchema.safeParse({
      nombre: 'Programacion Web',
      codigo: 'pw-101',
      carrera_id: '11111111-1111-4111-8111-111111111111',
      ciclo: 5,
      creditos: 4,
      activa: true,
    });

    expect(result.success).toBe(false);
  });

  it('rechaza usuarios con correo no institucional', () => {
    const result = createUsuarioSchema.safeParse({
      email: 'docente@gmail.com',
      nombre: 'Docente',
      apellido: 'Prueba',
      cedula: '1100000001',
      password: 'Password123',
      rol: 'docente',
      activo: true,
    });

    expect(result.success).toBe(false);
  });

  it('requiere contrasena fuerte al crear usuario', () => {
    const result = createUsuarioSchema.safeParse({
      email: 'docente@tecnologicoloja.edu.ec',
      nombre: 'Docente',
      apellido: 'Prueba',
      cedula: '1100000001',
      password: 'password',
      rol: 'docente',
      activo: true,
    });

    expect(result.success).toBe(false);
  });

  it('permite actualizacion parcial de usuario sin contrasena', () => {
    const result = updateUsuarioSchema.safeParse({
      telefono: '',
      activo: false,
    });

    expect(result.success).toBe(true);
  });
});
