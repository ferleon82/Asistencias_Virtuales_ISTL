import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { dateOnlyKey } from '../../shared/attendance/clock';
import { MAX_DIAS_POR_RANGO, type CrearDiasNoLaborablesInput, type ListarDiasNoLaborablesInput } from './calendario.schemas';

interface AuthScope {
  id: string;
  rol: string;
}

/** Columna @db.Date: medianoche UTC de la fecha indicada. */
function dbDate(fecha: string): Date {
  return new Date(`${fecha}T00:00:00Z`);
}

function formatFecha(fecha: string): string {
  const [year, month, day] = fecha.split('-');
  return `${day}/${month}/${year}`;
}

/** Fechas YYYY-MM-DD entre inicio y fin, inclusive. */
function fechasDelRango(inicio: string, fin: string): string[] {
  const fechas: string[] = [];
  for (const cursor = dbDate(inicio); dateOnlyKey(cursor) <= fin; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    fechas.push(dateOnlyKey(cursor));
  }
  return fechas;
}

function toDto(dia: { id: string; fecha: Date; descripcion: string }) {
  return { id: dia.id, fecha: dateOnlyKey(dia.fecha), descripcion: dia.descripcion };
}

export class CalendarioService {
  async list(filters: ListarDiasNoLaborablesInput) {
    const dias = await prisma.diaNoLaborable.findMany({
      where: {
        fecha: {
          gte: filters.desde ? dbDate(filters.desde) : undefined,
          lte: filters.hasta ? dbDate(filters.hasta) : undefined,
        },
      },
      orderBy: { fecha: 'asc' },
    });
    return dias.map(toDto);
  }

  /** Registra uno o varios días seguidos con la misma descripción; todos o ninguno. */
  async create(data: CrearDiasNoLaborablesInput, user: AuthScope, ip: string) {
    const fechas = fechasDelRango(data.fecha_inicio, data.fecha_fin ?? data.fecha_inicio);
    if (fechas.length > MAX_DIAS_POR_RANGO) {
      throw new AppError(`Registre como máximo ${MAX_DIAS_POR_RANGO} días a la vez.`, 400);
    }

    const existentes = await prisma.diaNoLaborable.findMany({
      where: { fecha: { in: fechas.map(dbDate) } },
      orderBy: { fecha: 'asc' },
    });
    if (existentes.length) {
      const detalle = existentes.map((dia) => `${formatFecha(dateOnlyKey(dia.fecha))} (${dia.descripcion})`).join(', ');
      throw new AppError(`Ya está registrado como no laborable: ${detalle}.`, 409);
    }

    const creados = await prisma.$transaction(
      fechas.map((fecha) => prisma.diaNoLaborable.create({ data: { fecha: dbDate(fecha), descripcion: data.descripcion } }))
    );
    await this.audit(user.id, 'CREATE_DIA_NO_LABORABLE', creados[0].id, ip, { ...data, fechas });
    return creados.map(toDto);
  }

  async remove(id: string, user: AuthScope, ip: string) {
    const dia = await prisma.diaNoLaborable.findUnique({ where: { id } });
    if (!dia) {
      throw new AppError('Día no laborable no encontrado.', 404);
    }
    await prisma.diaNoLaborable.delete({ where: { id } });
    await this.audit(user.id, 'DELETE_DIA_NO_LABORABLE', id, ip, toDto(dia));
    return toDto(dia);
  }

  private async audit(userId: string, accion: string, registroId: string, ip: string, datos: unknown) {
    await prisma.auditLog.create({
      data: { user_id: userId, accion, tabla_afectada: 'dias_no_laborables', registro_id: registroId, ip, datos_nuevos: datos as Prisma.InputJsonValue },
    });
  }
}

export const calendarioService = new CalendarioService();
