import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export type DbClient = Prisma.TransactionClient;

/**
 * Ejecuta una marcación (entrada o salida, de clase o administrativa) con un
 * bloqueo exclusivo por docente. Dos peticiones simultáneas del mismo docente
 * (doble clic, reintento de red) se procesan en serie, de modo que la segunda
 * ve el registro creado por la primera y es rechazada por las validaciones.
 *
 * Todas las lecturas y escrituras dentro de `fn` deben usar `tx` para no
 * requerir una segunda conexión del pool mientras se mantiene el bloqueo.
 */
export function withDocenteLock<T>(docenteId: string, fn: (tx: DbClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      // pg_advisory_xact_lock devuelve void; se envuelve para que Prisma pueda leer la fila.
      await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${`marcacion:${docenteId}`}))) AS bloqueo`;
      return fn(tx);
    },
    { timeout: 15_000 }
  );
}
