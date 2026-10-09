import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { signPhotoUrl, verifyPhotoSignature, withSignedPhotos } from './photoUrls';

const now = Date.UTC(2026, 9, 9, 15, 0, 0);
const ref = '/uploads/asistencias/user-1-entrada-1760000000000.jpg';
const parse = (url: string) => {
  const parsed = new URL(url, 'http://api');
  return { archivo: parsed.pathname.split('/').pop()!, exp: parsed.searchParams.get('exp')!, sig: parsed.searchParams.get('sig')! };
};

describe('enlaces firmados de fotos', () => {
  it('firma una referencia guardada y la firma se verifica', () => {
    const url = signPhotoUrl(ref, 3600, now)!;
    expect(url).toMatch(/^\/api\/v1\/fotos\/user-1-entrada-1760000000000\.jpg\?exp=\d+&sig=/);
    const { archivo, exp, sig } = parse(url);
    expect(verifyPhotoSignature(archivo, exp, sig, now)).toBe(true);
  });

  it('rechaza enlaces vencidos', () => {
    const { archivo, exp, sig } = parse(signPhotoUrl(ref, 3600, now)!);
    expect(verifyPhotoSignature(archivo, exp, sig, now + 3601_000)).toBe(false);
  });

  it('rechaza una firma usada para otro archivo o con la expiración alterada', () => {
    const { archivo, exp, sig } = parse(signPhotoUrl(ref, 3600, now)!);
    expect(verifyPhotoSignature('otro-entrada-1.jpg', exp, sig, now)).toBe(false);
    expect(verifyPhotoSignature(archivo, String(Number(exp) + 86400), sig, now)).toBe(false);
  });

  it('no firma referencias con rutas sospechosas', () => {
    expect(signPhotoUrl('/uploads/asistencias/../../.env', 3600, now)).toBeNull();
    expect(signPhotoUrl('https://otro.sitio/foto.jpg', 3600, now)).toBeNull();
    expect(verifyPhotoSignature('../secreto.jpg', '9999999999', 'x', now)).toBe(false);
  });

  it('firma las fotos de respuestas anidadas sin alterar fechas ni decimales', () => {
    const fecha = new Date('2026-10-09T10:00:00Z');
    const lat = new Prisma.Decimal('-3.99');
    const respuesta = { registroAbierto: { foto_entrada_url: ref, foto_salida_url: null, timestamp_entrada: fecha, lat }, lista: [{ foto_entrada_url: ref }] };

    const firmada = withSignedPhotos(respuesta, 3600, now);

    expect(firmada.registroAbierto.foto_entrada_url).toMatch(/^\/api\/v1\/fotos\//);
    expect(firmada.registroAbierto.foto_salida_url).toBeNull();
    expect(firmada.registroAbierto.timestamp_entrada).toBe(fecha);
    expect(firmada.registroAbierto.lat).toBe(lat);
    expect(firmada.lista[0].foto_entrada_url).toMatch(/^\/api\/v1\/fotos\//);
    expect(respuesta.registroAbierto.foto_entrada_url).toBe(ref);
  });
});
