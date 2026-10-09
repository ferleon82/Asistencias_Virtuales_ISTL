import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env';

// Las fotos no son públicas: se entregan con enlaces firmados que vencen. Solo
// las consultas que ya filtran por rol (reportes, listados de asistencia)
// generan estos enlaces, así que la firma acredita que quien lo recibió podía
// ver ese registro.

/** Validez de los enlaces mostrados en pantalla. */
export const PHOTO_URL_TTL_SECONDS = 2 * 60 * 60;
/** Validez de los enlaces incluidos en el Excel exportado. */
export const PHOTO_URL_EXPORT_TTL_SECONDS = 7 * 24 * 60 * 60;

export const PHOTO_ROUTE = '/api/v1/fotos';
const PHOTO_REFERENCE_PREFIX = '/uploads/asistencias/';
const PHOTO_FILENAME = /^[A-Za-z0-9-]+\.(jpg|png)$/;

/** Referencia que se guarda en la base para una foto almacenada. */
export function photoReference(filename: string): string {
  return `${PHOTO_REFERENCE_PREFIX}${filename}`;
}

export function isValidPhotoFilename(filename: string): boolean {
  return PHOTO_FILENAME.test(filename);
}

function filenameFromReference(reference: string): string | null {
  if (!reference.startsWith(PHOTO_REFERENCE_PREFIX)) return null;
  const filename = reference.slice(PHOTO_REFERENCE_PREFIX.length);
  return isValidPhotoFilename(filename) ? filename : null;
}

function signingKey(): Buffer {
  // Clave propia para fotos derivada del secreto de acceso: una firma de foto
  // nunca sirve como token ni al revés.
  return createHmac('sha256', env.JWT_ACCESS_SECRET).update('istl:fotos-asistencia').digest();
}

function signature(filename: string, expiresAt: number): string {
  return createHmac('sha256', signingKey()).update(`${filename}:${expiresAt}`).digest('base64url');
}

/**
 * Enlace firmado para una referencia guardada; `null` si no es válida. Sin
 * `baseUrl` es relativo a la API (el frontend le antepone su dirección); para
 * archivos exportados se pasa la dirección pública del backend.
 */
export function signPhotoUrl(
  reference: string | null | undefined,
  ttlSeconds: number,
  now = Date.now(),
  baseUrl = ''
): string | null {
  if (!reference) return null;
  const filename = filenameFromReference(reference);
  if (!filename) return null;

  const expiresAt = Math.floor(now / 1000) + ttlSeconds;
  return `${baseUrl.replace(/\/+$/, '')}${PHOTO_ROUTE}/${filename}?exp=${expiresAt}&sig=${signature(filename, expiresAt)}`;
}

export function verifyPhotoSignature(filename: string, exp: unknown, sig: unknown, now = Date.now()): boolean {
  if (!isValidPhotoFilename(filename) || typeof exp !== 'string' || typeof sig !== 'string' || !/^\d+$/.test(exp)) {
    return false;
  }

  const expiresAt = Number(exp);
  if (expiresAt < Math.floor(now / 1000)) return false;

  const expected = Buffer.from(signature(filename, expiresAt));
  const received = Buffer.from(sig);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

type WithPhotos = { foto_entrada_url?: string | null; foto_salida_url?: string | null };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Reemplaza las referencias `foto_entrada_url`/`foto_salida_url` por enlaces
 * firmados en cualquier respuesta (objetos y arreglos anidados). Conserva
 * fechas, decimales y demás instancias tal como están.
 */
export function withSignedPhotos<T>(value: T, ttlSeconds = PHOTO_URL_TTL_SECONDS, now = Date.now(), baseUrl = ''): T {
  if (Array.isArray(value)) {
    return value.map((item) => withSignedPhotos(item, ttlSeconds, now, baseUrl)) as T;
  }
  if (!isPlainObject(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] =
      key === 'foto_entrada_url' || key === 'foto_salida_url'
        ? signPhotoUrl(item as WithPhotos['foto_entrada_url'], ttlSeconds, now, baseUrl)
        : withSignedPhotos(item, ttlSeconds, now, baseUrl);
  }
  return result as T;
}
