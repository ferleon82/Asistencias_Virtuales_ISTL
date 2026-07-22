import { describe, expect, it } from 'vitest';
import { createHorarioSchema, horarioQuerySchema, updateHorarioSchema } from './horarios.schemas';

const validHorario = {
  materia_id: '11111111-1111-4111-8111-111111111111',
  docente_id: '22222222-2222-4222-8222-222222222222',
  dia_semana: 'lunes',
  hora_inicio: '08:00',
  hora_fin: '10:00',
  ciclo: '2026-I',
  jornada: 'matutina',
  modalidad: 'virtual',
  fecha_inicio_ciclo: '2026-04-01',
  fecha_fin_ciclo: '2026-09-30',
};

describe('horarios schemas', () => {
  it('acepta un horario válido', () => {
    const result = createHorarioSchema.safeParse(validHorario);
    expect(result.success).toBe(true);
  });

  it('rechaza horas con formato inválido', () => {
    const result = createHorarioSchema.safeParse({
      ...validHorario,
      hora_inicio: '8:00',
    });

    expect(result.success).toBe(false);
  });

  it('rechaza hora fin anterior a hora inicio', () => {
    const result = createHorarioSchema.safeParse({
      ...validHorario,
      hora_inicio: '10:00',
      hora_fin: '08:00',
    });

    expect(result.success).toBe(false);
  });

  it('rechaza fecha fin de ciclo anterior al inicio', () => {
    const result = createHorarioSchema.safeParse({
      ...validHorario,
      fecha_inicio_ciclo: '2026-10-01',
      fecha_fin_ciclo: '2026-09-30',
    });

    expect(result.success).toBe(false);
  });

  it('permite actualizaciónes parciales válidas', () => {
    const result = updateHorarioSchema.safeParse({
      hora_inicio: '09:00',
      hora_fin: '11:00',
    });

    expect(result.success).toBe(true);
  });

  it('convierte activo en query string a boolean', () => {
    const result = horarioQuerySchema.safeParse({ activo: 'true' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.activo).toBe(true);
  });
});
