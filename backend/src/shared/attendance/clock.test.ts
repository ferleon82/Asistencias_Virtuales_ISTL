import { describe, expect, it } from 'vitest';
import { DiaSemana } from '@prisma/client';
import { atEcuadorTime, ecuadorDateKey, ecuadorDayRange, ecuadorDbDate, ecuadorWeekday } from './clock';

// Las pruebas deben pasar con cualquier zona horaria en el servidor (TZ=UTC, Asia/Tokyo...).
describe('reloj de Ecuador', () => {
  const nocheLunes = new Date('2026-10-05T21:30:00-05:00'); // martes 02:30 en UTC

  it('usa la fecha de Ecuador aunque en UTC ya sea el día siguiente', () => {
    expect(ecuadorDateKey(nocheLunes)).toBe('2026-10-05');
    expect(ecuadorWeekday(nocheLunes)).toBe(DiaSemana.lunes);
  });

  it('ubica una hora HH:mm en el mismo día de Ecuador', () => {
    expect(atEcuadorTime(nocheLunes, '07:00').toISOString()).toBe('2026-10-05T12:00:00.000Z');
  });

  it('el rango del día cubre de 00:00 a 23:59:59.999 en Ecuador', () => {
    const { gte, lte } = ecuadorDayRange(nocheLunes);
    expect(gte.toISOString()).toBe('2026-10-05T05:00:00.000Z');
    expect(lte.toISOString()).toBe('2026-10-06T04:59:59.999Z');
  });

  it('compara contra columnas Date usando la medianoche UTC del día de Ecuador', () => {
    expect(ecuadorDbDate(nocheLunes).toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });

  it('el domingo no tiene día académico', () => {
    expect(ecuadorWeekday(new Date('2026-10-11T10:00:00-05:00'))).toBeNull();
  });
});
