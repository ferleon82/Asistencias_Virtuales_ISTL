import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiaSemana, EstadoAsistencia, Modalidad } from '@prisma/client';
import { AppError } from '../../shared/middleware/errorHandler';
import { AsistenciasService } from './asistencias.service';

vi.mock('../../config/database', () => ({
  prisma: {
    horario: {
      findMany: vi.fn(),
    },
    registroAsistencia: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    systemSetting: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('../../shared/utils/timezone', () => ({
  nowInEcuador: vi.fn(() => new Date(2026, 4, 11, 10, 33, 0, 0)),
  calcularEstadoAsistencia: vi.fn(() => EstadoAsistencia.puntual),
}));

import { prisma } from '../../config/database';

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
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue({ value: 'true' } as never);
  });

  it('bloquea una segunda entrada para el mismo horario en el mismo dia', async () => {
    vi.mocked(prisma.registroAsistencia.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingRegistro as never);
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
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue({ value: 'false' } as never);
    vi.mocked(prisma.registroAsistencia.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
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

  it('ignora horarios cuya hora fin ya paso al buscar clase activa', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValue([endedHorario, activeHorario] as never);
    vi.mocked(prisma.registroAsistencia.findFirst).mockResolvedValue(null);

    const estado = await service.getEstadoActual(user);

    expect(estado.horarioActivo?.id).toBe(activeHorario.id);
    expect(estado.puedeMarcarEntrada).toBe(true);
  });

  it('mantiene bloqueada la salida antes de los ultimos 10 minutos de clase', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValue([activeHorario] as never);
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
});
