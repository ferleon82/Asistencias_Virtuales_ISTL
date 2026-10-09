import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import type { DbClient } from './lock';

export interface AuditEntry {
  userId: string;
  accion: string;
  tabla: string;
  registroId: string;
  ip: string;
  datos: unknown;
}

export async function registrarAuditoria(entry: AuditEntry, db: DbClient = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      user_id: entry.userId,
      accion: entry.accion,
      tabla_afectada: entry.tabla,
      registro_id: entry.registroId,
      ip: entry.ip,
      datos_nuevos: entry.datos as Prisma.InputJsonValue,
    },
  });
}
