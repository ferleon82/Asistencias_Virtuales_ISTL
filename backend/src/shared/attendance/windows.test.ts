import { describe, expect, it } from 'vitest';
import { defaultAttendanceWindows as windows } from './settings';
import { bloqueActivo, estadoEntrada, marcacionAbiertaVigente, permiteEntrada, ventanaSalida } from './windows';

const at = (time: string) => new Date(`2026-10-05T${time.length === 5 ? `${time}:00` : time}-05:00`);

describe('ventanas de marcado', () => {
  it.each([
    ['07:44', 'fuera_de_ventana'],
    ['07:45', 'puntual'],
    ['08:05', 'puntual'],
    ['08:05:30', 'puntual'],
    ['08:05:59', 'puntual'],
    ['08:06', 'tardanza'],
    ['08:15', 'tardanza'],
    ['08:16', 'fuera_de_ventana'],
  ])('a las %s la entrada a una clase de 08:00 es %s', (time, estado) => {
    expect(estadoEntrada(at(time), '08:00', windows)).toBe(estado);
  });

  it('respeta ventanas configuradas distintas de las de fábrica', () => {
    const amplias = { ...windows, entryAfterMinutes: 30 };
    expect(estadoEntrada(at('08:25'), '08:00', amplias)).toBe('tardanza');
  });

  it('no admite entrada después de terminado el bloque aunque siga en la ventana', () => {
    expect(permiteEntrada(at('08:12'), { hora_inicio: '08:00', hora_fin: '08:10' }, windows)).toBe(false);
  });

  it('elige el primer bloque que admite entrada, sin importar el orden recibido', () => {
    const bloques = [
      { id: 'tarde', hora_inicio: '09:00', hora_fin: '10:00' },
      { id: 'terminado', hora_inicio: '07:00', hora_fin: '08:00' },
      { id: 'actual', hora_inicio: '08:50', hora_fin: '09:00' },
    ];
    expect(bloqueActivo(bloques, at('08:52'), windows)?.id).toBe('actual');
  });

  it('calcula la ventana de salida sobre el día de la entrada', () => {
    const salida = ventanaSalida(at('07:58'), '10:00', windows);
    expect(salida.desde).toEqual(at('09:50'));
    expect(salida.hasta).toEqual(at('10:15'));
  });

  it('una marcación abierta deja de bloquear al vencer su ventana de salida', () => {
    expect(marcacionAbiertaVigente(at('07:58'), '10:00', at('10:15'), windows)).toBe(true);
    expect(marcacionAbiertaVigente(at('07:58'), '10:00', at('10:16'), windows)).toBe(false);
  });
});
