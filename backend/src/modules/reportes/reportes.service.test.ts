import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiaSemana, EstadoAsistencia, Rol } from '@prisma/client';

vi.mock('../../config/database', () => ({
  prisma: {
    periodoAcademico: { findUnique: vi.fn() },
    registroAdministrativo: { findMany: vi.fn() },
    horarioAdministrativo: { findMany: vi.fn() },
    systemSetting: { findMany: vi.fn().mockResolvedValue([]) },
    diaNoLaborable: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  },
}));

// Lunes 5 de octubre de 2026 por la tarde: ambos bloques de las 08:00 ya iniciaron.
vi.mock('../../shared/attendance/clock', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/attendance/clock')>()),
  currentTime: vi.fn(() => new Date('2026-10-05T18:00:00-05:00')),
}));

import { prisma } from '../../config/database';
import { ReportesService } from './reportes.service';

const service = new ReportesService();
const periodo = { id: 'p1', nombre: '2026-II', codigo: '2026-II' };
const ana = { id: 'd-ana', nombre: 'Ana', apellido: 'Pérez', email: 'ana.perez@tecnologicoloja.edu.ec' };
const luis = { id: 'd-luis', nombre: 'Luis', apellido: 'Mora', email: 'luis.mora@tecnologicoloja.edu.ec' };
const bloque = (id: string, docente: typeof ana) => ({
  id,
  docente_id: docente.id,
  docente,
  dia_semana: DiaSemana.lunes,
  hora_inicio: '08:00',
  hora_fin: '10:00',
  fecha_inicio: new Date('2026-09-01T00:00:00Z'),
  fecha_fin: new Date('2027-02-28T00:00:00Z'),
  periodo_academico: periodo,
});
const filtros = { tipo: 'administrativa' as const, fecha_inicio: new Date('2026-10-05'), fecha_fin: new Date('2026-10-05') };

describe('ReportesService - jornada administrativa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.horarioAdministrativo.findMany).mockResolvedValue([bloque('b-ana', ana), bloque('b-luis', luis)] as never);
    vi.mocked(prisma.registroAdministrativo.findMany).mockResolvedValue([
      {
        id: 'r1',
        docente_id: ana.id,
        docente: ana,
        horario_administrativo_id: 'b-ana',
        horario_administrativo: { ...bloque('b-ana', ana), descripcion: 'Tutorías' },
        timestamp_entrada: new Date('2026-10-05T07:58:00-05:00'),
        timestamp_salida: new Date('2026-10-05T10:01:00-05:00'),
        estado: EstadoAsistencia.puntual,
        justificacion: null,
        created_at: new Date('2026-10-05T07:58:00-05:00'),
      },
    ] as never);
  });

  it.each([Rol.talento_humano, Rol.tics, Rol.rectorado])('%s puede verla, desglosada por docente', async (rol) => {
    const data = await service.resumen(filtros, { id: 'u1', rol });

    expect(data.totalProgramadas).toBe(2);
    expect(data.presentes).toBe(1);
    expect(data.ausente).toBe(1);
    expect(data.porCarrera).toEqual([
      expect.objectContaining({ carrera: 'Ana Pérez', codigo: 'ana.perez', programadas: 1, presentes: 1 }),
      expect.objectContaining({ carrera: 'Luis Mora', codigo: 'luis.mora', programadas: 1, presentes: 0, ausente: 1 }),
    ]);
  });

  it('cuenta y filtra las marcaciones que quedaron sin salida', async () => {
    const abierta = {
      id: 'r2',
      docente_id: luis.id,
      docente: luis,
      horario_administrativo_id: 'b-luis',
      horario_administrativo: { ...bloque('b-luis', luis), descripcion: 'Planificación' },
      timestamp_entrada: new Date('2026-10-05T07:59:00-05:00'),
      timestamp_salida: null,
      estado: EstadoAsistencia.puntual,
      justificacion: null,
      created_at: new Date('2026-10-05T07:59:00-05:00'),
    };
    const completa = (await prisma.registroAdministrativo.findMany({} as never))[0];
    vi.mocked(prisma.registroAdministrativo.findMany).mockResolvedValue([completa, abierta] as never);

    const data = await service.resumen(filtros, { id: 'u1', rol: Rol.talento_humano });
    expect(data.sin_salida).toBe(1);
    expect(data.registros.map((item) => [item.id, item.sin_salida])).toEqual([['r1', false], ['r2', true]]);

    const filtrado = await service.resumen({ ...filtros, estado: 'sin_salida' }, { id: 'u1', rol: Rol.talento_humano });
    expect(filtrado.registros.map((item) => item.id)).toEqual(['r2']);
    expect(vi.mocked(prisma.registroAdministrativo.findMany).mock.calls.at(-1)![0].where).toMatchObject({ timestamp_salida: null });
  });

  it('coordinación no puede verla', async () => {
    await expect(service.resumen(filtros, { id: 'u1', rol: Rol.coordinador })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('un docente solo consulta sus propios bloques', async () => {
    await service.resumen({ ...filtros, docente_id: luis.id }, { id: ana.id, rol: Rol.docente });

    expect(vi.mocked(prisma.horarioAdministrativo.findMany).mock.calls[0][0].where).toMatchObject({ docente_id: ana.id });
    expect(vi.mocked(prisma.registroAdministrativo.findMany).mock.calls[0][0].where).toMatchObject({ docente_id: ana.id });
  });
});
