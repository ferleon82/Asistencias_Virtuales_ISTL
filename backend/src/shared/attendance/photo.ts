import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../middleware/errorHandler';

const MAX_PHOTO_BYTES = 650_000;
const uploadsDir = path.resolve(process.cwd(), 'uploads', 'asistencias');

/**
 * Valida y guarda la foto de una marcación. Devuelve la URL pública relativa o
 * `null` cuando no se envió foto y no es obligatoria.
 *
 * @param prefijo identifica el origen en el nombre del archivo (p. ej. `entrada`
 *   o `administrativa-salida`).
 */
export async function saveAttendancePhoto(
  photoBase64: string | undefined,
  userId: string,
  prefijo: string,
  required: boolean
): Promise<string | null> {
  if (!photoBase64) {
    if (!required) return null;
    throw new AppError('Debe capturar una foto con la cámara para registrar la asistencia.', 400);
  }

  const match = photoBase64.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
  if (!match) {
    throw new AppError('La foto enviada no tiene un formato válido.', 400);
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw new AppError('La foto de asistencia supera el tamaño permitido.', 413);
  }

  await fs.mkdir(uploadsDir, { recursive: true });

  const safeUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
  const extension = match[1] === 'png' ? 'png' : 'jpg';
  const filename = `${safeUserId}-${prefijo}-${Date.now()}.${extension}`;
  await fs.writeFile(path.join(uploadsDir, filename), buffer);

  return `/uploads/asistencias/${filename}`;
}
