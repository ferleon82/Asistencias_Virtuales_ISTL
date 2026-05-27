import { Prisma, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import type {
  CarreraInput,
  CreateUsuarioInput,
  MateriaInput,
  PeriodoAcademicoInput,
  UpdateUsuarioInput,
} from './admin.schemas';

interface AuthScope {
  id: string;
  rol: string;
}

function isFullAdmin(user: AuthScope): boolean {
  return user.rol === Rol.tics || user.rol === Rol.rectorado || user.rol === Rol.talento_humano;
}

function carreraScope(user: AuthScope): Prisma.CarreraWhereInput {
  if (user.rol === Rol.coordinador) {
    return { coordinador_id: user.id };
  }
  return {};
}

export class AdminService {
  private assertFullAdmin(user: AuthScope): void {
    if (!isFullAdmin(user)) {
      throw new AppError('Solo TICs, Rectorado o Talento Humano pueden gestionar usuarios.', 403);
    }
  }

  async listUsuarios(user: AuthScope) {
    this.assertFullAdmin(user);

    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        cedula: true,
        rol: true,
        telefono: true,
        activo: true,
        ultimo_acceso: true,
        created_at: true,
        _count: {
          select: {
            materias_impartidas: true,
            carreras_coordinadas: true,
            registros_asistencia: true,
          },
        },
      },
      orderBy: [{ activo: 'desc' }, { apellido: 'asc' }, { nombre: 'asc' }],
    });
  }

  async createUsuario(data: CreateUsuarioInput, user: AuthScope, ip: string) {
    this.assertFullAdmin(user);

    const { password, ...profile } = data;
    const passwordHash = await bcrypt.hash(password, 12);

    const usuario = await prisma.user.create({
      data: {
        ...profile,
        password_hash: passwordHash,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        cedula: true,
        rol: true,
        telefono: true,
        activo: true,
        created_at: true,
      },
    });

    await this.audit(user.id, 'CREATE_USUARIO', 'users', usuario.id, ip, profile);
    return usuario;
  }

  async updateUsuario(id: string, data: UpdateUsuarioInput, user: AuthScope, ip: string) {
    this.assertFullAdmin(user);

    const { password, ...profile } = data;
    const updateData: Prisma.UserUpdateInput = { ...profile };

    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 12);
    }

    const usuario = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        cedula: true,
        rol: true,
        telefono: true,
        activo: true,
        ultimo_acceso: true,
        created_at: true,
      },
    });

    if (password || data.activo === false) {
      await prisma.refreshToken.updateMany({
        where: { user_id: id, revocado: false },
        data: { revocado: true },
      });
    }

    await this.audit(user.id, 'UPDATE_USUARIO', 'users', id, ip, profile);
    return usuario;
  }

  async listCarreras(user: AuthScope) {
    return prisma.carrera.findMany({
      where: carreraScope(user),
      include: {
        coordinador: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
        _count: {
          select: { materias: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async createCarrera(data: CarreraInput, user: AuthScope, ip: string) {
    if (!isFullAdmin(user)) {
      throw new AppError('Solo TICs, Rectorado o Talento Humano pueden crear carreras.', 403);
    }

    const carrera = await prisma.carrera.create({ data });
    await this.audit(user.id, 'CREATE_CARRERA', 'carreras', carrera.id, ip, data);
    return carrera;
  }

  async updateCarrera(id: string, data: Partial<CarreraInput>, user: AuthScope, ip: string) {
    if (!isFullAdmin(user)) {
      throw new AppError('Solo TICs, Rectorado o Talento Humano pueden actualizar carreras.', 403);
    }

    const carrera = await prisma.carrera.update({ where: { id }, data });
    await this.audit(user.id, 'UPDATE_CARRERA', 'carreras', id, ip, data);
    return carrera;
  }

  async deactivateCarrera(id: string, user: AuthScope, ip: string) {
    if (!isFullAdmin(user)) {
      throw new AppError('Solo TICs, Rectorado o Talento Humano pueden eliminar carreras.', 403);
    }

    const carrera = await prisma.carrera.update({
      where: { id },
      data: {
        activa: false,
        materias: {
          updateMany: {
            where: { activa: true },
            data: { activa: false },
          },
        },
      },
    });
    await prisma.horario.updateMany({
      where: { materia: { carrera_id: id }, activo: true },
      data: { activo: false },
    });
    await this.audit(user.id, 'DEACTIVATE_CARRERA', 'carreras', id, ip, { activa: false });
    return carrera;
  }

  async listMaterias(user: AuthScope) {
    return prisma.materia.findMany({
      where: {
        carrera: carreraScope(user),
      },
      include: {
        carrera: { select: { id: true, nombre: true, codigo: true } },
        docente: { select: { id: true, nombre: true, apellido: true, email: true } },
      },
      orderBy: [{ carrera: { nombre: 'asc' } }, { ciclo: 'asc' }, { nombre: 'asc' }],
    });
  }

  async listPeriodosAcademicos() {
    return prisma.periodoAcademico.findMany({
      orderBy: [{ activo: 'desc' }, { fecha_inicio: 'desc' }, { nombre: 'asc' }],
    });
  }

  async createPeriodoAcademico(data: PeriodoAcademicoInput, user: AuthScope, ip: string) {
    if (!isFullAdmin(user)) {
      throw new AppError('Solo TICs, Rectorado o Talento Humano pueden crear periodos academicos.', 403);
    }

    const periodo = await prisma.periodoAcademico.create({ data });
    await this.audit(user.id, 'CREATE_PERIODO_ACADEMICO', 'periodos_academicos', periodo.id, ip, data);
    return periodo;
  }

  async updatePeriodoAcademico(id: string, data: Partial<PeriodoAcademicoInput>, user: AuthScope, ip: string) {
    if (!isFullAdmin(user)) {
      throw new AppError('Solo TICs, Rectorado o Talento Humano pueden actualizar periodos academicos.', 403);
    }

    const periodo = await prisma.periodoAcademico.update({ where: { id }, data });

    if (data.codigo || data.fecha_inicio || data.fecha_fin) {
      await prisma.horario.updateMany({
        where: { periodo_academico_id: id },
        data: {
          ciclo: data.codigo ?? periodo.codigo,
          fecha_inicio_ciclo: data.fecha_inicio ?? periodo.fecha_inicio,
          fecha_fin_ciclo: data.fecha_fin ?? periodo.fecha_fin,
        },
      });
    }

    await this.audit(user.id, 'UPDATE_PERIODO_ACADEMICO', 'periodos_academicos', id, ip, data);
    return periodo;
  }

  async deactivatePeriodoAcademico(id: string, user: AuthScope, ip: string) {
    if (!isFullAdmin(user)) {
      throw new AppError('Solo TICs, Rectorado o Talento Humano pueden desactivar periodos academicos.', 403);
    }

    const periodo = await prisma.periodoAcademico.update({
      where: { id },
      data: { activo: false },
    });
    await this.audit(user.id, 'DEACTIVATE_PERIODO_ACADEMICO', 'periodos_academicos', id, ip, { activo: false });
    return periodo;
  }

  async createMateria(data: MateriaInput, user: AuthScope, ip: string) {
    await this.assertCanManageCarrera(data.carrera_id, user);
    await this.assertMateriaCapacity(data.carrera_id, data.ciclo);
    const materia = await prisma.materia.create({ data });
    await this.audit(user.id, 'CREATE_MATERIA', 'materias', materia.id, ip, data);
    return materia;
  }

  async updateMateria(id: string, data: Partial<MateriaInput>, user: AuthScope, ip: string) {
    const current = await prisma.materia.findUnique({ where: { id }, select: { carrera_id: true, ciclo: true } });
    if (!current) throw new AppError('Materia no encontrada.', 404);

    await this.assertCanManageCarrera(data.carrera_id ?? current.carrera_id, user);
    await this.assertMateriaCapacity(data.carrera_id ?? current.carrera_id, data.ciclo ?? current.ciclo, id);

    const materia = await prisma.materia.update({ where: { id }, data });
    await this.audit(user.id, 'UPDATE_MATERIA', 'materias', id, ip, data);
    return materia;
  }

  async deactivateMateria(id: string, user: AuthScope, ip: string) {
    const current = await prisma.materia.findUnique({ where: { id }, select: { carrera_id: true } });
    if (!current) throw new AppError('Materia no encontrada.', 404);

    await this.assertCanManageCarrera(current.carrera_id, user);

    const materia = await prisma.materia.update({
      where: { id },
      data: {
        activa: false,
        horarios: {
          updateMany: {
            where: { activo: true },
            data: { activo: false },
          },
        },
      },
    });
    await this.audit(user.id, 'DEACTIVATE_MATERIA', 'materias', id, ip, { activa: false });
    return materia;
  }

  async listDocentes() {
    return prisma.user.findMany({
      where: {
        rol: { in: [Rol.docente, Rol.coordinador] },
        activo: true,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        rol: true,
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });
  }

  private async assertCanManageCarrera(carreraId: string, user: AuthScope): Promise<void> {
    if (isFullAdmin(user)) return;

    const carrera = await prisma.carrera.findFirst({
      where: {
        id: carreraId,
        coordinador_id: user.id,
      },
      select: { id: true },
    });

    if (!carrera) {
      throw new AppError('No puede gestionar materias de una carrera no coordinada.', 403);
    }
  }

  private async assertMateriaCapacity(carreraId: string, ciclo: number, excludeId?: string): Promise<void> {
    const total = await prisma.materia.count({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        carrera_id: carreraId,
        ciclo,
        activa: true,
      },
    });

    if (total >= 5) {
      throw new AppError('Ya existen 5 materias activas para esta carrera y ciclo.', 409);
    }
  }

  private async audit(
    userId: string,
    accion: string,
    table: string,
    recordId: string,
    ip: string,
    payload: unknown
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        accion,
        tabla_afectada: table,
        registro_id: recordId,
        ip,
        datos_nuevos: payload as Prisma.InputJsonValue,
      },
    });
  }
}

export const adminService = new AdminService();
