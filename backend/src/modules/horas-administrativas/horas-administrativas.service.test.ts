import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiaSemana, EstadoAsistencia } from '@prisma/client';
import { HorasAdministrativasService } from './horas-administrativas.service';

vi.mock('../../config/database', () => {
  const prisma = {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    horarioAdministrativo: { findMany: vi.fn() },
    registroAdministrativo: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    registroAsistencia: { findMany: vi.fn() },
    systemSetting: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return { prisma };
});

vi.mock('node:fs/promises', () => ({
  default: { mkdir: vi.fn(), writeFile: vi.fn() },
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

const clock = vi.hoisted(() => ({ now: new Date('2026-10-05T14:02:00-05:00') }));
vi.mock('../../shared/attendance/clock', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/attendance/clock')>()),
  currentTime: vi.fn(() => clock.now),
}));

import { prisma } from '../../config/database';

const service = new HorasAdministrativasService();
const user = { id: 'docente-1', rol: 'docente' };

const bloque = {
  id: 'adm-1',
  docente_id: user.id,
  dia_semana: DiaSemana.lunes,
  hora_inicio: '14:00',
  hora_fin: '16:00',
  fecha_inicio: new Date('2026-09-01T00:00:00.000Z'),
  fecha_fin: new Date('2026-10-05T00:00:00.000Z'),
};

describe('HorasAdministrativasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clock.now = new Date('2026-10-05T14:02:00-05:00');
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([{ key: 'attendance_photo_required', value: 'false' }] as never);
    vi.mocked(prisma.horarioAdministrativo.findMany).mockResolvedValue([bloque] as never);
    vi.mocked(prisma.registroAdministrativo.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.registroAdministrativo.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.registroAsistencia.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.registroAdministrativo.create).mockResolvedValue({ id: 'reg-1' } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
  });

  it('marca la entrada dentro del bloqueo por docente con el estado calculado', async () => {
    await service.marcarEntrada(user, {}, '127.0.0.1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.registroAdministrativo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: EstadoAsistencia.puntual, horario_administrativo_id: 'adm-1' }) })
    );
  });

  it('busca bloques vigentes comparando con el día de Ecuador, incluido el último día del período', async () => {
    await service.marcarEntrada(user, {}, '127.0.0.1');

    expect(prisma.horarioAdministrativo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dia_semana: DiaSemana.lunes,
          fecha_inicio: { lte: new Date('2026-10-05T00:00:00.000Z') },
          fecha_fin: { gte: new Date('2026-10-05T00:00:00.000Z') },
        }),
      })
    );
  });

  it('bloquea la entrada mientras una clase sigue abierta y dentro de su ventana de salida', async () => {
    vi.mocked(prisma.registroAsistencia.findMany).mockResolvedValue([
      { timestamp_entrada: new Date('2026-10-05T12:58:00-05:00'), horario: { hora_fin: '14:00' } },
    ] as never);

    await expect(service.marcarEntrada(user, {}, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Debe marcar salida de la clase antes de iniciar una hora administrativa.',
    });
    expect(prisma.registroAdministrativo.create).not.toHaveBeenCalled();
  });

  it('una clase con salida olvidada y ventana vencida no bloquea la jornada administrativa', async () => {
    vi.mocked(prisma.registroAsistencia.findMany).mockResolvedValue([
      { timestamp_entrada: new Date('2026-10-05T07:58:00-05:00'), horario: { hora_fin: '10:00' } },
    ] as never);

    await expect(service.marcarEntrada(user, {}, '127.0.0.1')).resolves.toBeDefined();
    expect(prisma.registroAdministrativo.create).toHaveBeenCalledTimes(1);
  });

  it('el domingo responde sin bloque activo en lugar de un error', async () => {
    clock.now = new Date('2026-10-11T14:02:00-05:00');

    const estado = await service.estadoActual(user);

    expect(estado.horarioActivo).toBeNull();
    expect(estado.puedeMarcarEntrada).toBe(false);
    expect(prisma.horarioAdministrativo.findMany).not.toHaveBeenCalled();
  });

  it('no ofrece marcar entrada si el bloque de hoy ya fue marcado', async () => {
    vi.mocked(prisma.registroAdministrativo.findFirst)
      .mockResolvedValueOnce(null) // registro abierto
      .mockResolvedValueOnce({ id: 'ya-marcado' } as never); // registro del bloque hoy

    const estado = await service.estadoActual(user);

    expect(estado.horarioActivo?.id).toBe('adm-1');
    expect(estado.puedeMarcarEntrada).toBe(false);
  });

  it('una marcación administrativa vencida no se ofrece para cerrar', async () => {
    clock.now = new Date('2026-10-05T16:30:00-05:00');
    vi.mocked(prisma.registroAdministrativo.findFirst).mockResolvedValueOnce({
      id: 'abierta',
      timestamp_entrada: new Date('2026-10-05T14:01:00-05:00'),
      horario_administrativo: bloque,
    } as never);

    const estado = await service.estadoActual(user);

    expect(estado.registroAbierto).toBeNull();
    expect(estado.puedeMarcarSalida).toBe(false);
  });
});
