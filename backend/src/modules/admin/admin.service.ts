import { Prisma, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import type {
  CarreraInput,
  CreateUsuarioInput,
  MateriaInput,
  ModulePermissionsInput,
  PeriodoAcademicoInput,
  SystemSettingsInput,
  UpdateUsuarioInput,
} from './admin.schemas';

interface AuthScope {
  id: string;
  rol: string;
}

const systemModules: Array<{ key: string; label: string; roles: Rol[] }> = [
  {
    key: 'teacher_attendance',
    label: 'Marcar asistencia',
    roles: [Rol.docente],
  },
  {
    key: 'teacher_day',
    label: 'Mi jornada docente',
    roles: [Rol.docente],
  },
  {
    key: 'analytics',
    label: 'Dashboard interactivo',
    roles: [Rol.tics, Rol.rectorado, Rol.talento_humano],
  },
  {
    key: 'users',
    label: 'Gestión de usuarios',
    roles: [Rol.tics, Rol.rectorado, Rol.talento_humano],
  },
  {
    key: 'academic',
    label: 'Gestión académica',
    roles: [Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano],
  },
  {
    key: 'schedules',
    label: 'Administración de horarios',
    roles: [Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano],
  },
  {
    key: 'reports',
    label: 'Reportes de asistencia',
    roles: [Rol.docente, Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano],
  },
  {
    key: 'system_status',
    label: 'Estado del sistema',
    roles: [Rol.tics],
  },
  {
    key: 'module_permissions',
    label: 'Configuración de módulos',
    roles: [Rol.tics],
  },
];

const configurableRoles: Rol[] = [Rol.docente, Rol.coordinador, Rol.tics, Rol.rectorado, Rol.talento_humano];

const defaultSystemSettings = {
  attendance_photo_required: {
    label: 'Registro con imagen',
    value: 'false',
    description: 'Exige capturar una foto del docente al marcar ingreso y salida.',
  },
} as const;

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
      throw new AppError('Solo TICs, Rectorado o Talento Humano pueden crear períodos académicos.', 403);
    }

    const periodo = await prisma.periodoAcademico.create({ data });
    await this.audit(user.id, 'CREATE_PERIODO_ACADEMICO', 'periodos_academicos', periodo.id, ip, data);
    return periodo;
  }

  async updatePeriodoAcademico(id: string, data: Partial<PeriodoAcademicoInput>, user: AuthScope, ip: string) {
    if (!isFullAdmin(user)) {
      throw new AppError('Solo TICs, Rectorado o Talento Humano pueden actualizar períodos académicos.', 403);
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
      throw new AppError('Solo TICs, Rectorado o Talento Humano pueden desactivar períodos académicos.', 403);
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

  async listModulePermissions() {
    await this.ensureModulePermissions();

    return prisma.modulePermission.findMany({
      orderBy: [{ module_key: 'asc' }, { rol: 'asc' }],
    });
  }

  async listCurrentModulePermissions(user: AuthScope) {
    await this.ensureModulePermissions();

    return prisma.modulePermission.findMany({
      where: { rol: user.rol as Rol },
      orderBy: { module_key: 'asc' },
    });
  }

  async updateModulePermissions(data: ModulePermissionsInput, user: AuthScope, ip: string) {
    if (user.rol !== Rol.tics) {
      throw new AppError('Solo TICs puede configurar módulos del sistema.', 403);
    }

    await this.ensureModulePermissions();
    const validModules = new Set(systemModules.map((module) => module.key));

    await prisma.$transaction(
      data.permissions
        .filter((permission) => validModules.has(permission.module_key))
        .map((permission) =>
          prisma.modulePermission.update({
            where: {
              module_key_rol: {
                module_key: permission.module_key,
                rol: permission.rol,
              },
            },
            data: {
              enabled: permission.module_key === 'module_permissions' && permission.rol === Rol.tics ? true : permission.enabled,
            },
          })
        )
    );

    await this.audit(user.id, 'UPDATE_MODULE_PERMISSIONS', 'module_permissions', null, ip, data);
    return this.listModulePermissions();
  }

  async listSystemSettings() {
    await this.ensureSystemSettings();
    const settings = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });

    return {
      attendance_photo_required:
        settings.find((setting) => setting.key === 'attendance_photo_required')?.value !== 'false',
      items: settings,
    };
  }

  async updateSystemSettings(data: SystemSettingsInput, user: AuthScope, ip: string) {
    if (user.rol !== Rol.tics) {
      throw new AppError('Solo TICs puede configurar el sistema.', 403);
    }

    await this.ensureSystemSettings();
    const setting = await prisma.systemSetting.update({
      where: { key: 'attendance_photo_required' },
      data: { value: String(data.attendance_photo_required) },
    });

    await this.audit(user.id, 'UPDATE_SYSTEM_SETTINGS', 'system_settings', setting.id, ip, data);
    return this.listSystemSettings();
  }

  private async ensureModulePermissions(): Promise<void> {
    await prisma.$transaction(
      systemModules.flatMap((module) =>
        configurableRoles.map((rol) =>
          prisma.modulePermission.upsert({
            where: {
              module_key_rol: {
                module_key: module.key,
                rol,
              },
            },
            create: {
              module_key: module.key,
              module_label: module.label,
              rol,
              enabled: module.roles.includes(rol),
            },
            update: {
              module_label: module.label,
            },
          })
        )
      )
    );
  }

  private async ensureSystemSettings(): Promise<void> {
    await prisma.systemSetting.upsert({
      where: { key: 'attendance_photo_required' },
      create: {
        key: 'attendance_photo_required',
        label: defaultSystemSettings.attendance_photo_required.label,
        value: defaultSystemSettings.attendance_photo_required.value,
        description: defaultSystemSettings.attendance_photo_required.description,
      },
      update: {
        label: defaultSystemSettings.attendance_photo_required.label,
        description: defaultSystemSettings.attendance_photo_required.description,
      },
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

    if (total >= 7) {
      throw new AppError('Ya existen 7 materias activas para esta carrera y ciclo.', 409);
    }
  }

  private async audit(
    userId: string,
    accion: string,
    table: string,
    recordId: string | null,
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
