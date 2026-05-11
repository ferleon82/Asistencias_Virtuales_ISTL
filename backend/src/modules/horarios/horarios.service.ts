import { Prisma, Rol } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import type { CreateHorarioInput, HorarioQueryInput, UpdateHorarioInput } from './horarios.schemas';

interface AuthScope {
  id: string;
  rol: string;
}

const horarioInclude = {
  materia: {
    select: {
      id: true,
      nombre: true,
      codigo: true,
      docente_id: true,
      docente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
        },
      },
      carrera: {
        select: {
          id: true,
          nombre: true,
          codigo: true,
          coordinador_id: true,
        },
      },
    },
  },
} satisfies Prisma.HorarioInclude;

function buildRoleWhere(user: AuthScope): Prisma.HorarioWhereInput {
  if (user.rol === Rol.docente) {
    return { materia: { docente_id: user.id } };
  }

  if (user.rol === Rol.coordinador) {
    return { materia: { carrera: { coordinador_id: user.id } } };
  }

  return {};
}

function buildFilterWhere(filters: HorarioQueryInput): Prisma.HorarioWhereInput {
  return {
    materia_id: filters.materia_id,
    dia_semana: filters.dia_semana,
    ciclo: filters.ciclo,
    modalidad: filters.modalidad,
    activo: filters.activo,
    materia: {
      docente_id: filters.docente_id,
      carrera_id: filters.carrera_id,
    },
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

export class HorariosService {
  async list(filters: HorarioQueryInput, user: AuthScope) {
    const where: Prisma.HorarioWhereInput = {
      AND: [buildRoleWhere(user), buildFilterWhere(filters)],
    };

    return prisma.horario.findMany({
      where,
      include: horarioInclude,
      orderBy: [{ ciclo: 'desc' }, { dia_semana: 'asc' }, { hora_inicio: 'asc' }],
    });
  }

  async getById(id: string, user: AuthScope) {
    const horario = await prisma.horario.findFirst({
      where: {
        id,
        AND: [buildRoleWhere(user)],
      },
      include: horarioInclude,
    });

    if (!horario) {
      throw new AppError('Horario no encontrado.', 404);
    }

    return horario;
  }

  async create(data: CreateHorarioInput, user: AuthScope, ip: string) {
    await this.assertMateriaManageable(data.materia_id, user);
    await this.assertNoOverlap(data);

    const horario = await prisma.horario.create({
      data,
      include: horarioInclude,
    });

    await this.audit(user.id, 'CREATE_HORARIO', horario.id, ip, null, data);

    return horario;
  }

  async update(id: string, data: UpdateHorarioInput, user: AuthScope, ip: string) {
    const current = await this.getManageableHorario(id, user);
    const nextMateriaId = data.materia_id ?? current.materia_id;

    if (data.materia_id) {
      await this.assertMateriaManageable(data.materia_id, user);
    }

    await this.assertNoOverlap(
      {
        materia_id: nextMateriaId,
        dia_semana: data.dia_semana ?? current.dia_semana,
        hora_inicio: data.hora_inicio ?? current.hora_inicio,
        hora_fin: data.hora_fin ?? current.hora_fin,
        ciclo: data.ciclo ?? current.ciclo,
        modalidad: data.modalidad ?? current.modalidad,
        url_aula_virtual: data.url_aula_virtual ?? current.url_aula_virtual ?? undefined,
        activo: data.activo ?? current.activo,
        fecha_inicio_ciclo: data.fecha_inicio_ciclo ?? current.fecha_inicio_ciclo,
        fecha_fin_ciclo: data.fecha_fin_ciclo ?? current.fecha_fin_ciclo,
      },
      id
    );

    const horario = await prisma.horario.update({
      where: { id },
      data,
      include: horarioInclude,
    });

    await this.audit(user.id, 'UPDATE_HORARIO', id, ip, current, data);

    return horario;
  }

  async deactivate(id: string, user: AuthScope, ip: string) {
    const current = await this.getManageableHorario(id, user);

    const horario = await prisma.horario.update({
      where: { id },
      data: { activo: false },
      include: horarioInclude,
    });

    await this.audit(user.id, 'DEACTIVATE_HORARIO', id, ip, current, { activo: false });

    return horario;
  }

  private async getManageableHorario(id: string, user: AuthScope) {
    const horario = await prisma.horario.findFirst({
      where: {
        id,
        AND: [buildRoleWhere(user)],
      },
    });

    if (!horario) {
      throw new AppError('Horario no encontrado o sin permisos de gestion.', 404);
    }

    return horario;
  }

  private async assertMateriaManageable(materiaId: string, user: AuthScope): Promise<void> {
    const materia = await prisma.materia.findUnique({
      where: { id: materiaId },
      select: {
        docente_id: true,
        carrera: {
          select: {
            coordinador_id: true,
          },
        },
      },
    });

    if (!materia) {
      throw new AppError('Materia no encontrada.', 404);
    }

    if (user.rol === Rol.coordinador && materia.carrera.coordinador_id !== user.id) {
      throw new AppError('No puede gestionar horarios de una carrera no coordinada.', 403);
    }
  }

  private async assertNoOverlap(data: CreateHorarioInput, excludeId?: string): Promise<void> {
    if (!data.activo) return;

    const existing = await prisma.horario.findMany({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        materia_id: data.materia_id,
        dia_semana: data.dia_semana,
        ciclo: data.ciclo,
        activo: true,
      },
      select: {
        hora_inicio: true,
        hora_fin: true,
      },
    });

    const hasOverlap = existing.some((item) =>
      overlaps(data.hora_inicio, data.hora_fin, item.hora_inicio, item.hora_fin)
    );

    if (hasOverlap) {
      throw new AppError('Ya existe un horario activo que se cruza para esta materia, dia y ciclo.', 409);
    }
  }

  private async audit(
    userId: string,
    accion: string,
    registroId: string,
    ip: string,
    previous: unknown,
    next: unknown
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        accion,
        tabla_afectada: 'horarios',
        registro_id: registroId,
        ip,
        datos_anteriores: previous as Prisma.InputJsonValue,
        datos_nuevos: next as Prisma.InputJsonValue,
      },
    });
  }
}

export const horariosService = new HorariosService();
