import { describe, expect, it } from 'vitest';
import { reporteQuerySchema } from './reportes.schemas';

describe('reportes schemas', () => {
  it('acepta filtros completos validos', () => {
    const result = reporteQuerySchema.safeParse({
      carrera_id: '11111111-1111-4111-8111-111111111111',
      materia_id: '22222222-2222-4222-8222-222222222222',
      docente_id: '33333333-3333-4333-8333-333333333333',
      fecha_inicio: '2026-05-01',
      fecha_fin: '2026-05-31',
      ciclo: '2026-I',
      estado: 'puntual',
    });

    expect(result.success).toBe(true);
  });

  it('rechaza fecha fin anterior a fecha inicio', () => {
    const result = reporteQuerySchema.safeParse({
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-05-01',
    });

    expect(result.success).toBe(false);
  });

  it('rechaza estado desconocido', () => {
    const result = reporteQuerySchema.safeParse({
      estado: 'pendiente',
    });

    expect(result.success).toBe(false);
  });

  it('rechaza IDs que no son UUID', () => {
    const result = reporteQuerySchema.safeParse({
      materia_id: 'materia-1',
    });

    expect(result.success).toBe(false);
  });
});
