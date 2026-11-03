import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiaSemana, Modalidad } from '@prisma/client';

vi.mock('../../config/database', () => {
  const prisma = {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn() },
    periodoAcademico: { findUnique: vi.fn() },
    horario: { findMany: vi.fn() },
    horarioAdministrativo: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return { prisma };
});

import { prisma } from '../../config/database';
import { HorasAdministrativasService } from './horas-administrativas.service';
import type { JornadaAdministrativaInput } from './horas-administrativas.schemas';

const service = new HorasAdministrativasService();
const th = { id: 'th-1', rol: 'talento_humano' };
const DOCENTE = '550e8400-e29b-41d4-a716-446655440000';
const PERIODO = '550e8400-e29b-41d4-a716-446655440001';
const GRUPO = '550e8400-e29b-41d4-a716-446655440002';
const fecha = (key: string) => new Date(`${key}T00:00:00Z`);

const jornada = (overrides: Partial<JornadaAdministrativaInput> = {}): JornadaAdministrativaInput => ({
  docente_id: DOCENTE,
  periodo_academico_id: PERIODO,
  modalidad: Modalidad.presencial,
  bloques: [
    { dia_semana: DiaSemana.lunes, hora_inicio: '08:00', hora_fin: '13:00' },
    { dia_semana: DiaSemana.martes, hora_inicio: '08:00', hora_fin: '13:00' },
  ],
  ...overrides,
});

describe('Jornada administrativa (servicio)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ rol: 'docente', activo: true } as never);
    vi.mocked(prisma.periodoAcademico.findUnique).mockResolvedValue({ activo: true, fecha_inicio: fecha('2026-09-01'), fecha_fin: fecha('2027-02-28') } as never);
    vi.mocked(prisma.horario.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.horarioAdministrativo.findMany).mockResolvedValue([] as never);
  });

  it('crea una jornada regular con las fechas del período y la jornada según la hora', async () => {
    await service.createJornada(jornada(), th, '127.0.0.1');

    expect(prisma.horarioAdministrativo.create).toHaveBeenCalledTimes(2);
    expect(prisma.horarioAdministrativo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dia_semana: 'lunes', temporal: false, jornada: 'matutina', fecha_inicio: fecha('2026-09-01'), fecha_fin: fecha('2027-02-28') }),
    });
  });

  it('una jornada temporal guarda sus fechas y no choca con la regular', async () => {
    await service.createJornada(jornada({ fecha_inicio: '2026-11-09', fecha_fin: '2026-11-20', modalidad: Modalidad.virtual }), th, '127.0.0.1');

    // Solo se buscan cruces con otras jornadas temporales, nunca con la regular.
    expect(prisma.horarioAdministrativo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ temporal: true }) }));
    expect(prisma.horarioAdministrativo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ temporal: true, modalidad: 'virtual', fecha_inicio: fecha('2026-11-09'), fecha_fin: fecha('2026-11-20') }),
    });
  });

  it('rechaza una jornada temporal fuera del período', async () => {
    await expect(service.createJornada(jornada({ fecha_inicio: '2027-02-20', fecha_fin: '2027-03-05' }), th, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Las fechas de la jornada temporal deben estar dentro del período (01/09/2026 al 28/02/2027).',
    });
  });

  it('rechaza una jornada temporal que se superpone con otra temporal', async () => {
    vi.mocked(prisma.horarioAdministrativo.findMany).mockResolvedValueOnce([
      { dia_semana: 'viernes', hora_inicio: '08:00', hora_fin: '09:00', fecha_inicio: fecha('2026-11-16'), fecha_fin: fecha('2026-11-27') },
    ] as never);

    await expect(service.createJornada(jornada({ fecha_inicio: '2026-11-09', fecha_fin: '2026-11-20' }), th, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'El docente ya tiene una jornada temporal del 16/11/2026 al 27/11/2026; las fechas no pueden superponerse.',
    });
    expect(prisma.horarioAdministrativo.create).not.toHaveBeenCalled();
  });

  it('indica la clase con la que se cruza un bloque', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValue([
      { dia_semana: 'martes', hora_inicio: '10:00', hora_fin: '12:00', materia: { nombre: 'Base de Datos' } },
    ] as never);

    await expect(service.createJornada(jornada(), th, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'El bloque del martes 08:00-13:00 se cruza con la clase de Base de Datos (10:00-12:00).',
    });
  });

  it('al editar conserva los bloques que siguen, crea los nuevos y desactiva los quitados', async () => {
    vi.mocked(prisma.horarioAdministrativo.findFirst).mockResolvedValue({ id: 'a' } as never);
    vi.mocked(prisma.horarioAdministrativo.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        { id: 'lunes', docente_id: DOCENTE, periodo_academico_id: PERIODO, dia_semana: 'lunes', hora_inicio: '08:00', hora_fin: '13:00' },
        { id: 'viernes', docente_id: DOCENTE, periodo_academico_id: PERIODO, dia_semana: 'viernes', hora_inicio: '08:00', hora_fin: '13:00' },
      ] as never);

    await service.updateJornada(GRUPO, jornada(), th, '127.0.0.1');

    expect(prisma.horarioAdministrativo.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'lunes' } }));
    expect(prisma.horarioAdministrativo.create).toHaveBeenCalledWith({ data: expect.objectContaining({ dia_semana: 'martes', grupo_id: GRUPO }) });
    expect(prisma.horarioAdministrativo.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['viernes'] } }, data: { activo: false } });
  });

  it('responde 404 al editar o desactivar una jornada inexistente', async () => {
    vi.mocked(prisma.horarioAdministrativo.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.horarioAdministrativo.updateMany).mockResolvedValue({ count: 0 } as never);

    await expect(service.updateJornada(GRUPO, jornada(), th, '127.0.0.1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.deactivateJornada(GRUPO, th, '127.0.0.1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
