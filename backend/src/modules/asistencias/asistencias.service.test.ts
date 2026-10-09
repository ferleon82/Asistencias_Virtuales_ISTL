import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiaSemana, EstadoAsistencia, Modalidad } from '@prisma/client';
import { AppError } from '../../shared/middleware/errorHandler';
import { AsistenciasService } from './asistencias.service';

vi.mock('../../config/database', () => {
  const prisma = {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    horario: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    registroAsistencia: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    registroAdministrativo: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    systemSetting: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  // La transacción con bloqueo por docente se ejecuta sobre el mismo cliente simulado.
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return { prisma };
});

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

// Lunes 11 de mayo de 2026, 10:33 en Ecuador, sin depender de la zona horaria de la máquina.
vi.mock('../../shared/attendance/clock', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/attendance/clock')>()),
  currentTime: vi.fn(() => new Date('2026-05-11T10:33:00-05:00')),
}));

function settings(photoRequired: boolean) {
  return [{ key: 'attendance_photo_required', value: String(photoRequired) }];
}

import { prisma } from '../../config/database';
import { currentTime } from '../../shared/attendance/clock';

const service = new AsistenciasService();

const user = {
  id: 'docente-1',
  rol: 'docente',
};

const cameraPhoto = `data:image/jpeg;base64,${Buffer.from('foto-prueba').toString('base64')}`;

const activeHorario = {
  id: 'horario-1',
  materia_id: 'materia-1',
  dia_semana: DiaSemana.lunes,
  hora_inicio: '10:32',
  hora_fin: '10:35',
  ciclo: '2026-I',
  modalidad: Modalidad.virtual,
  url_aula_virtual: null,
  activo: true,
  fecha_inicio_ciclo: new Date('2026-05-01T00:00:00.000Z'),
  fecha_fin_ciclo: new Date('2026-10-31T00:00:00.000Z'),
  created_at: new Date('2026-05-01T00:00:00.000Z'),
  materia: {
    id: 'materia-1',
    nombre: 'Reparacion de Motores',
    codigo: 'RM-26',
  },
};

const endedHorario = {
  ...activeHorario,
  id: 'horario-finalizado',
  hora_inicio: '10:20',
  hora_fin: '10:25',
  materia: {
    id: 'materia-finalizada',
    nombre: 'Clase Finalizada',
    codigo: 'END-1',
  },
};

const existingRegistro = {
  id: 'registro-1',
  docente_id: user.id,
  horario_id: activeHorario.id,
  timestamp_entrada: new Date('2026-05-11T10:32:00.000Z'),
  timestamp_salida: new Date('2026-05-11T10:35:00.000Z'),
  ip_entrada: '127.0.0.1',
  ip_salida: '127.0.0.1',
  lat: null,
  lng: null,
  precision_m: null,
  estado: EstadoAsistencia.puntual,
  justificacion: null,
  user_agent: null,
  created_at: new Date('2026-05-11T10:32:00.000Z'),
  updated_at: new Date('2026-05-11T10:35:00.000Z'),
};

const openRegistro = {
  ...existingRegistro,
  timestamp_salida: null,
  horario: {
    ...activeHorario,
    materia: {
      id: 'materia-1',
      nombre: 'Reparacion de Motores',
      codigo: 'RM-26',
      docente_id: user.id,
      carrera: {
        id: 'carrera-1',
        nombre: 'Mecanica',
        codigo: 'MEC',
        coordinador_id: null,
      },
    },
  },
};

const earlyExitRegistro = {
  ...openRegistro,
  horario: {
    ...openRegistro.horario,
    hora_fin: '10:50',
  },
};

describe('AsistenciasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValue(settings(true) as never);
    vi.mocked(prisma.registroAsistencia.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.registroAdministrativo.findMany).mockResolvedValue([] as never);
  });

  it('bloquea una segunda entrada para el mismo horario en el mismo dia', async () => {
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(existingRegistro as never);
    vi.mocked(prisma.horario.findMany).mockResolvedValue([activeHorario] as never);

    await expect(service.marcarEntrada(user, {}, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'La asistencia de esta clase ya fue registrada. No puede marcar ingreso nuevamente.',
    } satisfies Partial<AppError>);

    expect(prisma.registroAsistencia.create).not.toHaveBeenCalled();
  });

  it('permite marcar entrada sin foto cuando el registro con imagen esta desactivado', async () => {
    const registroSinFoto = {
      ...existingRegistro,
      foto_entrada_url: null,
    };
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValue(settings(false) as never);
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.horario.findMany).mockResolvedValue([activeHorario] as never);
    vi.mocked(prisma.registroAsistencia.create).mockResolvedValue(registroSinFoto as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await expect(service.marcarEntrada(user, {}, '127.0.0.1')).resolves.toEqual(registroSinFoto);
    expect(prisma.registroAsistencia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ foto_entrada_url: null }),
      })
    );
  });

  it('deshabilita marcar entrada si el horario activo ya tiene asistencia cerrada', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValue([activeHorario] as never);
    vi.mocked(prisma.registroAsistencia.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingRegistro as never);

    const estado = await service.getEstadoActual(user);

    expect(estado.puedeMarcarEntrada).toBe(false);
    expect(estado.puedeMarcarSalida).toBe(false);
  });

  it('el domingo responde sin clase activa en lugar de un error', async () => {
    vi.mocked(currentTime).mockReturnValueOnce(new Date('2026-05-10T10:33:00-05:00'));
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(null);

    const estado = await service.getEstadoActual(user);

    expect(estado.horarioActivo).toBeNull();
    expect(estado.puedeMarcarEntrada).toBe(false);
    expect(prisma.horario.findMany).not.toHaveBeenCalled();
  });

  it('busca clases vigentes incluido el último día del período', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(null);

    await service.getEstadoActual(user);

    expect(prisma.horario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dia_semana: DiaSemana.lunes,
          fecha_inicio_ciclo: { lte: new Date('2026-05-11T00:00:00.000Z') },
          fecha_fin_ciclo: { gte: new Date('2026-05-11T00:00:00.000Z') },
        }),
      })
    );
  });

  it('ignora horarios cuya hora fin ya paso al buscar clase activa', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValue([endedHorario, activeHorario] as never);
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(null);

    const estado = await service.getEstadoActual(user);

    expect(estado.horarioActivo?.id).toBe(activeHorario.id);
    expect(estado.puedeMarcarEntrada).toBe(true);
  });

  it('mantiene bloqueada la salida antes de los ultimos 10 minutos de clase', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValue([activeHorario] as never);
    vi.mocked(prisma.registroAsistencia.findMany).mockResolvedValue([earlyExitRegistro] as never);
    vi.mocked(prisma.registroAsistencia.findFirst)
      .mockResolvedValueOnce(earlyExitRegistro as never)
      .mockResolvedValueOnce(null);

    const estado = await service.getEstadoActual(user);

    expect(estado.puedeMarcarEntrada).toBe(false);
    expect(estado.puedeMarcarSalida).toBe(false);
    expect(estado.salidaBloqueadaMotivo).toBe('La salida se habilita 10 minutos antes de la hora de fin de la clase.');
  });

  it('rechaza marcar salida antes de los ultimos 10 minutos de clase', async () => {
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(earlyExitRegistro as never);

    await expect(service.marcarSalida(user, {}, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 400,
      message: 'La salida se habilita 10 minutos antes de la hora de fin de la clase.',
    } satisfies Partial<AppError>);

    expect(prisma.registroAsistencia.update).not.toHaveBeenCalled();
  });

  it('permite marcar salida desde 10 minutos antes de la hora fin', async () => {
    const closeToEndRegistro = {
      ...openRegistro,
      horario: {
        ...openRegistro.horario,
        hora_fin: '10:40',
      },
    };
    const updatedRegistro = {
      ...closeToEndRegistro,
      timestamp_salida: new Date('2026-05-11T10:33:00.000Z'),
    };
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(closeToEndRegistro as never);
    vi.mocked(prisma.registroAsistencia.update).mockResolvedValue(updatedRegistro as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await expect(service.marcarSalida(user, { foto_base64: cameraPhoto }, '127.0.0.1')).resolves.toEqual(updatedRegistro);
  });

  it('guarda el GPS de salida en sus propios campos y dentro del bloqueo por docente', async () => {
    const closeToEndRegistro = {
      ...openRegistro,
      horario: {
        ...openRegistro.horario,
        hora_fin: '10:40',
      },
    };
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(closeToEndRegistro as never);
    vi.mocked(prisma.registroAsistencia.update).mockResolvedValue(closeToEndRegistro as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await service.marcarSalida(user, { lat: -3.99, lng: -79.2, precision_m: 12, foto_base64: cameraPhoto }, '127.0.0.1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.registroAsistencia.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lat_salida: -3.99, lng_salida: -79.2, precision_salida_m: 12 }),
      })
    );
  });

  it('marca la entrada dentro del bloqueo por docente', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValue([activeHorario] as never);
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.registroAsistencia.create).mockResolvedValue({ id: 'nuevo', foto_entrada_url: null } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await service.marcarEntrada(user, { foto_base64: cameraPhoto }, '127.0.0.1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.registroAsistencia.create).toHaveBeenCalledTimes(1);
  });

  it('rechaza solicitar justificación cuando la marcación ya tiene salida', async () => {
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(existingRegistro as never);

    await expect(
      service.solicitarJustificacion(
        existingRegistro.id,
        { justificacion: 'No pude registrar correctamente por problemas de conexión.' },
        user,
        '127.0.0.1'
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'La justificación solo puede solicitarse mientras la marcación permanece abierta.',
    } satisfies Partial<AppError>);

    expect(prisma.registroAsistencia.update).not.toHaveBeenCalled();
  });

  it('permite solicitar justificación con marcación abierta dentro de la holgura', async () => {
    const justifiedRegistro = {
      ...openRegistro,
      justificacion: 'No pude registrar correctamente por problemas de conexión.',
    };
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(openRegistro as never);
    vi.mocked(prisma.registroAsistencia.update).mockResolvedValue(justifiedRegistro as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await expect(
      service.solicitarJustificacion(
        openRegistro.id,
        { justificacion: 'No pude registrar correctamente por problemas de conexión.' },
        user,
        '127.0.0.1'
      )
    ).resolves.toEqual(justifiedRegistro);
  });
  it('muestra una marcación vencida sin salida como salida pendiente', async () => {
    const expiredOpenRegistro = {
      ...openRegistro,
      horario: {
        ...openRegistro.horario,
        hora_inicio: '10:00',
        hora_fin: '10:10',
      },
    };
    vi.mocked(prisma.registroAsistencia.findMany).mockResolvedValue([expiredOpenRegistro] as never);

    const registros = await service.list({}, user);

    expect(registros[0]).toMatchObject({
      estado_operativo: 'salida_pendiente',
      puede_solicitar_justificacion: true,
    });
  });

  it('permite justificar una salida olvidada después de la holgura', async () => {
    const expiredOpenRegistro = {
      ...openRegistro,
      horario: {
        ...openRegistro.horario,
        hora_inicio: '10:00',
        hora_fin: '10:10',
      },
    };
    const justifiedRegistro = {
      ...expiredOpenRegistro,
      justificacion: 'Olvidé registrar la salida al finalizar la clase.',
    };
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(expiredOpenRegistro as never);
    vi.mocked(prisma.registroAsistencia.update).mockResolvedValue(justifiedRegistro as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await expect(
      service.solicitarJustificacion(
        expiredOpenRegistro.id,
        { justificacion: 'Olvidé registrar la salida al finalizar la clase.' },
        user,
        '127.0.0.1'
      )
    ).resolves.toEqual(justifiedRegistro);
  });
});
