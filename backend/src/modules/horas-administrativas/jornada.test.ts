import { describe, expect, it } from 'vitest';
import { DiaSemana, Jornada } from '@prisma/client';
import { bloquesDelDia, jornadaPorHora, pausasPorDocente } from './jornada';
import { jornadaAdministrativaSchema } from './horas-administrativas.schemas';

const fecha = (key: string) => new Date(`${key}T00:00:00Z`);
const regular = { docente_id: 'd1', dia_semana: DiaSemana.lunes, temporal: false, fecha_inicio: fecha('2026-09-01'), fecha_fin: fecha('2027-02-28') };
const temporal = { ...regular, dia_semana: DiaSemana.martes, temporal: true, fecha_inicio: fecha('2026-11-09'), fecha_fin: fecha('2026-11-20') };

describe('Jornada administrativa temporal', () => {
  it('sin jornada temporal vigente cuentan los bloques regulares del día', () => {
    expect(bloquesDelDia([regular], DiaSemana.lunes)).toEqual([regular]);
  });

  it('con una jornada temporal vigente la regular queda en pausa, aunque la temporal no tenga bloque ese día', () => {
    expect(bloquesDelDia([regular, temporal], DiaSemana.lunes)).toEqual([]);
    expect(bloquesDelDia([regular, temporal], DiaSemana.martes)).toEqual([temporal]);
  });

  it('obtiene un rango de pausa por jornada temporal de cada docente', () => {
    const otroBloque = { ...temporal, dia_semana: DiaSemana.miercoles };
    expect(pausasPorDocente([regular, temporal, otroBloque])).toEqual(new Map([['d1', [{ desde: '2026-11-09', hasta: '2026-11-20' }]]]));
  });

  it('asigna la jornada según la hora de inicio', () => {
    expect(jornadaPorHora('08:00')).toBe(Jornada.matutina);
    expect(jornadaPorHora('14:00')).toBe(Jornada.vespertina);
    expect(jornadaPorHora('18:30')).toBe(Jornada.nocturna);
  });
});

describe('jornadaAdministrativaSchema', () => {
  const base = {
    docente_id: '550e8400-e29b-41d4-a716-446655440000',
    periodo_academico_id: '550e8400-e29b-41d4-a716-446655440001',
    bloques: [
      { dia_semana: 'lunes', hora_inicio: '08:00', hora_fin: '13:00' },
      { dia_semana: 'lunes', hora_inicio: '14:00', hora_fin: '17:00' },
    ],
  };

  it('acepta una jornada regular con dos bloques el mismo día', () => {
    expect(jornadaAdministrativaSchema.parse(base).bloques).toHaveLength(2);
  });

  it('exige las dos fechas de una jornada temporal, en orden', () => {
    expect(() => jornadaAdministrativaSchema.parse({ ...base, fecha_inicio: '2026-11-09' })).toThrow('Indique la fecha inicial y la final');
    expect(() => jornadaAdministrativaSchema.parse({ ...base, fecha_inicio: '2026-11-20', fecha_fin: '2026-11-09' })).toThrow('posterior a la inicial');
  });

  it('rechaza bloques que se cruzan el mismo día', () => {
    const bloques = [...base.bloques, { dia_semana: 'lunes', hora_inicio: '12:00', hora_fin: '15:00' }];
    expect(() => jornadaAdministrativaSchema.parse({ ...base, bloques })).toThrow('se cruzan');
  });
});
