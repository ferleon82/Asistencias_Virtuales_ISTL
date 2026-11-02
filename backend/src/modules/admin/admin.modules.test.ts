import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Rol } from '@prisma/client';

vi.mock('../../config/database', () => {
  const prisma = {
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    modulePermission: { upsert: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma };
});

import { prisma } from '../../config/database';
import { AdminService, moduloDisponible } from './admin.service';

const service = new AdminService();
const tics = { id: 'tics-1', rol: Rol.tics };

describe('Disponibilidad de módulos por rol', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Horas administrativas puede habilitarse para Talento Humano y TICs, no para otros roles', () => {
    expect(moduloDisponible('administrative_hours', Rol.talento_humano)).toBe(true);
    expect(moduloDisponible('administrative_hours', Rol.tics)).toBe(true);
    expect(moduloDisponible('administrative_hours', Rol.rectorado)).toBe(false);
    expect(moduloDisponible('calendar', Rol.rectorado)).toBe(false);
    expect(moduloDisponible('teacher_attendance', Rol.tics)).toBe(false);
    expect(moduloDisponible('reports', Rol.docente)).toBe(true);
    expect(moduloDisponible('modulo_inexistente', Rol.tics)).toBe(false);
  });

  it('marca las casillas que no aplican y no las reporta como habilitadas', async () => {
    vi.mocked(prisma.modulePermission.findMany).mockResolvedValue([
      { id: '1', module_key: 'administrative_hours', module_label: 'Horas administrativas', rol: Rol.tics, enabled: true },
      { id: '2', module_key: 'calendar', module_label: 'Calendario de feriados', rol: Rol.rectorado, enabled: true },
    ] as never);

    const permisos = await service.listModulePermissions();

    expect(permisos).toEqual([
      expect.objectContaining({ module_key: 'administrative_hours', enabled: true, disponible: true }),
      expect.objectContaining({ module_key: 'calendar', enabled: false, disponible: false }),
    ]);
  });

  it('al guardar, no habilita un módulo para un rol que no puede usarlo', async () => {
    vi.mocked(prisma.modulePermission.findMany).mockResolvedValue([] as never);

    await service.updateModulePermissions(
      {
        permissions: [
          { module_key: 'administrative_hours', rol: Rol.tics, enabled: true },
          { module_key: 'calendar', rol: Rol.rectorado, enabled: true },
        ],
      },
      tics,
      '127.0.0.1'
    );

    const updates = vi.mocked(prisma.modulePermission.update).mock.calls.map(([args]) => [args.where.module_key_rol, args.data.enabled]);
    expect(updates).toEqual([
      [{ module_key: 'administrative_hours', rol: Rol.tics }, true],
      [{ module_key: 'calendar', rol: Rol.rectorado }, false],
    ]);
  });
});
