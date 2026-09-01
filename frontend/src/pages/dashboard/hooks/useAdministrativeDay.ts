import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/axios';

export interface AdministrativeScheduleItem {
  id: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  jornada: string;
  modalidad: string;
  ubicacion?: string | null;
  descripcion?: string | null;
}

export interface AdministrativeRecordItem {
  id: string;
  timestamp_entrada: string | null;
  timestamp_salida: string | null;
  estado: string;
  horario_administrativo: AdministrativeScheduleItem;
}

function apiMessage(error: unknown): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo cargar su jornada administrativa.';
}

export function useAdministrativeDay(userRole: string | undefined, diaSemanaEcuador: string) {
  const [administrativeSchedulesToday, setAdministrativeSchedulesToday] = useState<AdministrativeScheduleItem[]>([]);
  const [administrativeHistory, setAdministrativeHistory] = useState<AdministrativeRecordItem[]>([]);
  const [administrativeDayError, setAdministrativeDayError] = useState('');

  const loadAdministrativeDay = useCallback(async () => {
    if (userRole !== 'docente') return;
    try {
      setAdministrativeDayError('');
      const [schedules, records] = await Promise.all([
        api.get(`/horas-administrativas?activo=true&dia_semana=${diaSemanaEcuador}`),
        api.get('/horas-administrativas/mis-registros'),
      ]);
      setAdministrativeSchedulesToday(schedules.data.data);
      setAdministrativeHistory(records.data.data);
    } catch (error) {
      setAdministrativeDayError(apiMessage(error));
    }
  }, [diaSemanaEcuador, userRole]);

  useEffect(() => {
    void loadAdministrativeDay();
  }, [loadAdministrativeDay]);

  return { administrativeSchedulesToday, administrativeHistory, administrativeDayError, loadAdministrativeDay };
}
