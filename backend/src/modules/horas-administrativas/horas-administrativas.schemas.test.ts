import { describe, expect, it } from 'vitest';
import { createHorarioAdministrativoSchema } from './horas-administrativas.schemas';

const validInput = {
  docente_id: '550e8400-e29b-41d4-a716-446655440000',
  periodo_academico_id: '550e8400-e29b-41d4-a716-446655440001',
  dia_semana: 'lunes',
  hora_inicio: '08:00',
  hora_fin: '11:00',
};

describe('createHorarioAdministrativoSchema', () => {
  it('acepta un bloque administrativo válido', () => {
    expect(createHorarioAdministrativoSchema.parse(validInput)).toMatchObject(validInput);
  });

  it('rechaza un bloque cuyo fin no es posterior al inicio', () => {
    expect(() => createHorarioAdministrativoSchema.parse({ ...validInput, hora_fin: '08:00' })).toThrow(
      'La hora de inicio debe ser anterior a la hora de fin.'
    );
  });
});
