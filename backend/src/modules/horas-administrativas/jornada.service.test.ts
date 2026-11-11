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

// Hoy: miércoles 11 de noviembre de 2026, a mitad del período (01/09/2026 al 28/02/2027).
vi.mock('../../shared/attendance/clock', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/attendance/clock')>()),
  currentTime: vi.fn(() => new Date('2026-11-11T10:00:00-05:00')),
}));

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

  it('una jornada regular nueva rige desde hoy hasta el fin del período, con la jornada según la hora', async () => {
    await service.createJornada(jornada(), th, '127.0.0.1');

    expect(prisma.horarioAdministrativo.create).toHaveBeenCalledTimes(2);
    expect(prisma.horarioAdministrativo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dia_semana: 'lunes', temporal: false, jornada: 'matutina', fecha_inicio: fecha('2026-11-11'), fecha_fin: fecha('2027-02-28') }),
    });
  });

  it('respeta "vigente desde" dentro del período y rechaza una fecha fuera de él', async () => {
    await service.createJornada(jornada({ vigente_desde: '2026-10-14' }), th, '127.0.0.1');
    expect(prisma.horarioAdministrativo.create).toHaveBeenCalledWith({ data: expect.objectContaining({ fecha_inicio: fecha('2026-10-14') }) });

    await expect(service.createJornada(jornada({ vigente_desde: '2026-08-15' }), th, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 400,
      message: 'La fecha "vigente desde" debe estar dentro del período (01/09/2026 al 28/02/2027).',
    });
  });

  it('al editar una jornada regular conserva la fecha desde la que ya regía', async () => {
    vi.mocked(prisma.horarioAdministrativo.findFirst).mockResolvedValue({ id: 'a', temporal: false, periodo_academico_id: PERIODO, fecha_inicio: fecha('2026-10-14') } as never);

    await service.updateJornada(GRUPO, jornada(), th, '127.0.0.1');

    expect(prisma.horarioAdministrativo.create).toHaveBeenCalledWith({ data: expect.objectContaining({ fecha_inicio: fecha('2026-10-14') }) });
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

  it('crea la jornada de varios docentes y reporta los que tienen cruce sin detener a los demás', async () => {
    const OTRO = '550e8400-e29b-41d4-a716-446655440003';
    const TERCERO = '550e8400-e29b-41d4-a716-446655440004';
    vi.mocked(prisma.horario.findMany).mockImplementation((({ where }: { where: { docente_id: string } }) =>
      Promise.resolve(where.docente_id === OTRO ? [{ dia_semana: 'lunes', hora_inicio: '09:00', hora_fin: '11:00', materia: { nombre: 'Programación I' } }] : [])) as never);
    vi.mocked(prisma.horarioAdministrativo.findMany).mockImplementation((({ include }: { include?: unknown }) =>
      Promise.resolve(include ? [{ grupo_id: 'g' }, { grupo_id: 'g' }] : [])) as never);

    const { docente_id: _omitido, ...comun } = jornada();
    const result = await service.createJornadas({ ...comun, docente_ids: [DOCENTE, OTRO, TERCERO] }, th, '127.0.0.1');

    expect(result.creadas.map((item) => item.docente_id)).toEqual([DOCENTE, TERCERO]);
    expect(result.creadas[0]).toMatchObject({ grupo_id: 'g', bloques: 2 });
    expect(result.fallidas).toEqual([{ docente_id: OTRO, mensaje: 'El bloque del lunes 08:00-13:00 se cruza con la clase de Programación I (09:00-11:00).' }]);
    // Cada docente recibe su propia jornada (grupo distinto).
    const grupos = vi.mocked(prisma.horarioAdministrativo.create).mock.calls.map(([arg]) => (arg as { data: { grupo_id: string; docente_id: string } }).data);
    expect(new Set(grupos.map((fila) => fila.grupo_id)).size).toBe(2);
    expect(grupos.every((fila) => fila.docente_id !== OTRO)).toBe(true);
  });

  it('un error inesperado detiene el lote', async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error('conexión perdida'));
    const { docente_id: _omitido, ...comun } = jornada();
    await expect(service.createJornadas({ ...comun, docente_ids: [DOCENTE] }, th, '127.0.0.1')).rejects.toThrow('conexión perdida');
  });

  it('responde 404 al editar o desactivar una jornada inexistente', async () => {
    vi.mocked(prisma.horarioAdministrativo.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.horarioAdministrativo.updateMany).mockResolvedValue({ count: 0 } as never);

    await expect(service.updateJornada(GRUPO, jornada(), th, '127.0.0.1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.deactivateJornada(GRUPO, th, '127.0.0.1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
