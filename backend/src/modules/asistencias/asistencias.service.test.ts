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
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../shared/utils/timezone', () => ({
  nowInEcuador: vi.fn(() => new Date('2026-05-11T10:33:00.000Z')),
  calcularEstadoAsistencia: vi.fn(() => EstadoAsistencia.puntual),
}));

import { prisma } from '../../config/database';

const service = new AsistenciasService();

const user = {
  id: 'docente-1',
  rol: 'docente',
};

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

describe('AsistenciasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('deshabilita marcar entrada si el horario activo ya tiene asistencia cerrada', async () => {
    vi.mocked(prisma.horario.findMany).mockResolvedValue([activeHorario] as never);
    vi.mocked(prisma.registroAsistencia.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingRegistro as never);

    const estado = await service.getEstadoActual(user);

    expect(estado.puedeMarcarEntrada).toBe(false);
    expect(estado.puedeMarcarSalida).toBe(false);
  });
});
