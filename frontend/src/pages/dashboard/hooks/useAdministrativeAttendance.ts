import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/axios';
import { getBrowserLocation } from '../geolocation';

type Action = 'entrada' | 'salida';

export interface AdministrativeAttendanceState {
  horarioActivo: { id: string; hora_inicio: string; hora_fin: string; jornada: string; ubicacion?: string | null; descripcion?: string | null } | null;
  registroAbierto: { id: string; timestamp_entrada: string | null } | null;
  puedeMarcarEntrada: boolean;
  puedeMarcarSalida: boolean;
  attendancePhotoRequired?: boolean;
  salidaDisponibleDesde?: string | null;
  salidaDisponibleHasta?: string | null;
  salidaBloqueadaMotivo?: string | null;
}

function message(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export function useAdministrativeAttendance(userRole?: string, onMarked?: () => Promise<void>) {
  const [state, setState] = useState<AdministrativeAttendanceState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const reload = useCallback(async () => {
    if (userRole !== 'docente') return;
    try {
      const { data } = await api.get('/horas-administrativas/estado-actual');
      setState(data.data);
    } catch (requestError) {
      setError(message(requestError, 'No se pudo obtener el estado administrativo.'));
    }
  }, [userRole]);

  useEffect(() => {
    void reload();
    if (userRole !== 'docente') return undefined;
    const timer = window.setInterval(() => void reload(), 30_000);
    return () => window.clearInterval(timer);
  }, [reload, userRole]);

  const mark = async (action: Action, photo?: string) => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const location = await getBrowserLocation();
      const { data } = await api.post(`/horas-administrativas/${action}`, { ...location, ...(photo ? { foto_base64: photo } : {}) });
      setSuccess(data.message);
      await reload();
      await onMarked?.();
    } catch (requestError) {
      setError(message(requestError, 'No se pudo registrar la asistencia administrativa.'));
    } finally { setLoading(false); }
  };

  const administrativeCanMarkExit = useMemo(() => {
    if (state?.puedeMarcarSalida) return true;
    if (!state?.registroAbierto || !state.salidaDisponibleDesde || !state.salidaDisponibleHasta) return false;
    const from = new Date(state.salidaDisponibleDesde).getTime();
    const until = new Date(state.salidaDisponibleHasta).getTime();
    return Number.isFinite(from) && Number.isFinite(until) && currentTime >= from && currentTime <= until;
  }, [currentTime, state]);

  return { administrativeState: state, administrativeCanMarkExit, administrativeLoading: loading, administrativeError: error, administrativeMessage: success, markAdministrative: mark };
}
