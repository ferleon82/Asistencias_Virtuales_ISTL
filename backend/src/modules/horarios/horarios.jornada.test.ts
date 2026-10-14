import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiaSemana, Jornada, Modalidad, Rol } from '@prisma/client';
import { jornadaSchema, type JornadaInput } from './horarios.schemas';

vi.mock('../../config/database', () => {
  const prisma = {
    $transaction: vi.fn(),
    materia: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    periodoAcademico: { findUnique: vi.fn() },
    asignacionDocente: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    horario: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    horarioAdministrativo: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: typeof prisma) => unknown)(prisma) : Promise.all(arg as unknown[])
  );
  return { prisma };
});

import { prisma } from '../../config/database';
import { HorariosService } from './horarios.service';

const ids = {
  materia: '11111111-1111-4111-8111-111111111111',
  docente: '22222222-2222-4222-8222-222222222222',
  otroDocente: '33333333-3333-4333-8333-333333333333',
  periodo: '44444444-4444-4444-8444-444444444444',
  asignacion: '55555555-5555-4555-8555-555555555555',
  lunes: '66666666-6666-4666-8666-666666666666',
  martes: '77777777-7777-4777-8777-777777777777',
  ajeno: '88888888-8888-4888-8888-888888888888',
};

const base = {
  materia_id: ids.materia,
  docente_id: ids.docente,
  periodo_academico_id: ids.periodo,
  jornada: Jornada.matutina,
  paralelo: 'A' as const,
  modalidad: Modalidad.presencial,
};

const jornada = (bloques: JornadaInput['bloques'], extra: Partial<JornadaInput> = {}): JornadaInput =>
  jornadaSchema.parse({ ...base, ...extra, bloques });

const metrologia = [
  { dia_semana: DiaSemana.lunes, hora_inicio: '08:00', hora_fin: '10:00' },
  { dia_semana: DiaSemana.martes, hora_inicio: '10:00', hora_fin: '11:00' },
  { dia_semana: DiaSemana.viernes, hora_inicio: '08:00', hora_fin: '10:00' },
];

describe('jornadaSchema', () => {
  it('acepta varios días y varios bloques el mismo día si no se cruzan', () => {
    const result = jornadaSchema.safeParse({
      ...base,
      bloques: [...metrologia, { dia_semana: DiaSemana.lunes, hora_inicio: '14:00', hora_fin: '15:00' }],
    });
    expect(result.success).toBe(true);
  });

  it('acepta bloques consecutivos el mismo día (uno termina cuando empieza el otro)', () => {
    const result = jornadaSchema.safeParse({
      ...base,
      bloques: [
        { dia_semana: DiaSemana.lunes, hora_inicio: '08:00', hora_fin: '10:00' },
        { dia_semana: DiaSemana.lunes, hora_inicio: '10:00', hora_fin: '11:00' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rechaza dos bloques que se cruzan el mismo día, sin importar el orden recibido', () => {
    const result = jornadaSchema.safeParse({
      ...base,
      bloques: [
        { dia_semana: DiaSemana.lunes, hora_inicio: '09:00', hora_fin: '11:00' },
        { dia_semana: DiaSemana.martes, hora_inicio: '08:00', hora_fin: '09:00' },
        { dia_semana: DiaSemana.lunes, hora_inicio: '08:00', hora_fin: '10:00' },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.errors[0].message).toContain('se cruzan');
  });

  it('rechaza una jornada sin días y un bloque con fin antes del inicio', () => {
    expect(jornadaSchema.safeParse({ ...base, bloques: [] }).success).toBe(false);
    expect(
      jornadaSchema.safeParse({ ...base, bloques: [{ dia_semana: DiaSemana.lunes, hora_inicio: '10:00', hora_fin: '08:00' }] }).success
    ).toBe(false);
  });

  it('trata un enlace de aula virtual vacío como ausente', () => {
    const result = jornadaSchema.parse({ ...base, url_aula_virtual: '', bloques: metrologia });
    expect(result.url_aula_virtual).toBeUndefined();
  });
});

describe('HorariosService - jornada semanal', () => {
  const service = new HorariosService();
  const tics = { id: 'tics-1', rol: Rol.tics };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.materia.findUnique).mockResolvedValue({ docente_id: null, carrera: { coordinador_id: 'coord-1' } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: ids.docente, rol: Rol.docente, activo: true } as never);
    vi.mocked(prisma.periodoAcademico.findUnique).mockResolvedValue({
      id: ids.periodo,
      codigo: '2026-2P',
      activo: true,
      fecha_inicio: new Date('2026-10-05T00:00:00Z'),
      fecha_fin: new Date('2027-03-31T00:00:00Z'),
    } as never);
    vi.mocked(prisma.asignacionDocente.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.asignacionDocente.upsert).mockResolvedValue({ id: ids.asignacion } as never);
    vi.mocked(prisma.horario.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.horarioAdministrativo.findMany).mockResolvedValue([] as never);
  });

  it('crea los tres bloques de la materia con los datos comunes del período, en una transacción', async () => {
    await service.createJornada(jornada(metrologia, { url_aula_virtual: 'https://aula.istl.edu.ec/metrologia' }), tics, '127.0.0.1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.horario.create).toHaveBeenCalledTimes(3);
    expect(prisma.horario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dia_semana: DiaSemana.viernes,
        hora_inicio: '08:00',
        hora_fin: '10:00',
        asignacion_docente_id: ids.asignacion,
        ciclo: '2026-2P',
        modalidad: Modalidad.presencial,
        url_aula_virtual: 'https://aula.istl.edu.ec/metrologia',
        fecha_inicio_ciclo: new Date('2026-10-05T00:00:00Z'),
        fecha_fin_ciclo: new Date('2027-03-31T00:00:00Z'),
      }),
    });
  });

  it('no guarda nada si un bloque se cruza con otra clase del docente e indica cuál', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValueOnce([
      { dia_semana: DiaSemana.viernes, hora_inicio: '09:00', hora_fin: '11:00', materia: { nombre: 'DIBUJO TÉCNICO' } },
    ] as never);

    await expect(service.createJornada(jornada(metrologia), tics, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'El bloque del viernes 08:00-10:00 se cruza con DIBUJO TÉCNICO (09:00-11:00) del mismo docente.',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.horario.create).not.toHaveBeenCalled();
  });

  it('detecta cruces con horas administrativas del docente', async () => {
    vi.mocked(prisma.horarioAdministrativo.findMany).mockResolvedValue([
      { dia_semana: DiaSemana.martes, hora_inicio: '10:30', hora_fin: '12:00' },
    ] as never);

    await expect(service.createJornada(jornada(metrologia), tics, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('martes 10:00-11:00 se cruza con una hora administrativa'),
    });
  });

  it('no crea una segunda jornada para la misma materia, docente y paralelo', async () => {
    vi.mocked(prisma.asignacionDocente.findUnique).mockResolvedValue({ id: ids.asignacion, horarios: [{ id: ids.lunes }] } as never);

    await expect(service.createJornada(jornada(metrologia), tics, '127.0.0.1')).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.horario.create).not.toHaveBeenCalled();
  });

  it('adopta un horario antiguo sin jornada conservando su id, sin duplicarlo', async () => {
    vi.mocked(prisma.horario.findMany)
      .mockResolvedValueOnce([{ id: ids.lunes }] as never) // horario adoptable
      .mockResolvedValue([] as never);

    await service.createJornada(
      jornada([
        { id: ids.lunes, dia_semana: DiaSemana.lunes, hora_inicio: '08:00', hora_fin: '10:00' },
        { dia_semana: DiaSemana.martes, hora_inicio: '10:00', hora_fin: '11:00' },
      ]),
      tics,
      '127.0.0.1'
    );

    expect(vi.mocked(prisma.horario.findMany).mock.calls[0][0]).toMatchObject({
      where: { id: { in: [ids.lunes] }, asignacion_docente_id: null, activo: true },
    });
    expect(prisma.horario.update).toHaveBeenCalledWith({
      where: { id: ids.lunes },
      data: expect.objectContaining({ asignacion_docente_id: ids.asignacion }),
    });
    expect(prisma.horario.create).toHaveBeenCalledTimes(1);
  });

  it('una jornada nueva no puede tomar bloques que ya pertenecen a otra jornada', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValueOnce([] as never);

    await expect(
      service.createJornada(
        jornada([{ id: ids.ajeno, dia_semana: DiaSemana.lunes, hora_inicio: '08:00', hora_fin: '10:00' }]),
        tics,
        '127.0.0.1'
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('al editar actualiza, crea y desactiva bloques sin borrar ninguno', async () => {
    vi.mocked(prisma.asignacionDocente.findUnique).mockResolvedValue({ materia_id: ids.materia } as never);
    vi.mocked(prisma.horario.findMany)
      .mockResolvedValueOnce([{ id: ids.lunes }, { id: ids.martes }] as never) // bloques actuales
      .mockResolvedValueOnce([] as never) // cruces con otras clases
      .mockResolvedValueOnce([] as never); // resultado final

    await service.updateJornada(
      ids.asignacion,
      jornada([
        { id: ids.lunes, dia_semana: DiaSemana.lunes, hora_inicio: '07:00', hora_fin: '09:00' },
        { dia_semana: DiaSemana.viernes, hora_inicio: '08:00', hora_fin: '10:00' },
      ]),
      tics,
      '127.0.0.1'
    );

    expect(prisma.horario.update).toHaveBeenCalledWith({
      where: { id: ids.lunes },
      data: expect.objectContaining({ hora_inicio: '07:00', hora_fin: '09:00' }),
    });
    expect(prisma.horario.create).toHaveBeenCalledWith({ data: expect.objectContaining({ dia_semana: DiaSemana.viernes }) });
    expect(prisma.horario.updateMany).toHaveBeenCalledWith({ where: { id: { in: [ids.martes] } }, data: { activo: false } });
    // Los bloques propios no cuentan como cruce consigo mismos.
    expect(vi.mocked(prisma.horario.findMany).mock.calls[1][0]).toMatchObject({
      where: { id: { notIn: [ids.lunes, ids.martes] } },
    });
  });

  it('al cambiar el docente mueve todos los bloques y cierra la asignación anterior', async () => {
    vi.mocked(prisma.asignacionDocente.findUnique).mockResolvedValue({ materia_id: ids.materia } as never);
    vi.mocked(prisma.horario.findMany).mockResolvedValueOnce([{ id: ids.lunes }] as never).mockResolvedValue([] as never);
    vi.mocked(prisma.asignacionDocente.upsert).mockResolvedValue({ id: 'nueva-asignacion' } as never);
    vi.mocked(prisma.horario.count).mockResolvedValue(0);

    await service.updateJornada(
      ids.asignacion,
      jornada([{ id: ids.lunes, dia_semana: DiaSemana.lunes, hora_inicio: '08:00', hora_fin: '10:00' }], { docente_id: ids.otroDocente }),
      tics,
      '127.0.0.1'
    );

    expect(prisma.horario.update).toHaveBeenCalledWith({
      where: { id: ids.lunes },
      data: expect.objectContaining({ docente_id: ids.otroDocente, asignacion_docente_id: 'nueva-asignacion' }),
    });
    expect(prisma.asignacionDocente.update).toHaveBeenCalledWith({ where: { id: ids.asignacion }, data: { activa: false } });
  });

  it('al editar una jornada puede incorporar un horario antiguo sin asignación', async () => {
    vi.mocked(prisma.asignacionDocente.findUnique).mockResolvedValue({ materia_id: ids.materia } as never);
    vi.mocked(prisma.horario.findMany)
      .mockResolvedValueOnce([{ id: ids.lunes }] as never) // bloques de la jornada
      .mockResolvedValueOnce([{ id: ids.martes }] as never) // horario antiguo adoptable
      .mockResolvedValue([] as never);

    await service.updateJornada(
      ids.asignacion,
      jornada([
        { id: ids.lunes, dia_semana: DiaSemana.lunes, hora_inicio: '08:00', hora_fin: '10:00' },
        { id: ids.martes, dia_semana: DiaSemana.martes, hora_inicio: '08:50', hora_fin: '10:25' },
      ]),
      tics,
      '127.0.0.1'
    );

    expect(prisma.horario.update).toHaveBeenCalledWith({
      where: { id: ids.martes },
      data: expect.objectContaining({ asignacion_docente_id: ids.asignacion }),
    });
    expect(prisma.horario.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza bloques que pertenecen a otra jornada', async () => {
    vi.mocked(prisma.asignacionDocente.findUnique).mockResolvedValue({ materia_id: ids.materia } as never);
    vi.mocked(prisma.horario.findMany).mockResolvedValueOnce([{ id: ids.lunes }] as never).mockResolvedValueOnce([] as never);

    await expect(
      service.updateJornada(
        ids.asignacion,
        jornada([{ id: ids.ajeno, dia_semana: DiaSemana.lunes, hora_inicio: '08:00', hora_fin: '10:00' }]),
        tics,
        '127.0.0.1'
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('un coordinador no puede gestionar jornadas de una carrera que no coordina', async () => {
    await expect(service.createJornada(jornada(metrologia), { id: 'otro-coord', rol: Rol.coordinador }, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
