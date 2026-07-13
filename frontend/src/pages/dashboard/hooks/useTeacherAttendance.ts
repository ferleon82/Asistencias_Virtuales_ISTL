import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/axios';
import { getBrowserLocation } from '../geolocation';
import type { AsistenciaItem, EstadoAsistenciaActual, HorarioItem } from '../types';

function getApiMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

interface UseTeacherAttendanceInput {
  userRole?: string;
  diaSemanaEcuador: string;
  loadReportSummary: () => Promise<void>;
}

export function useTeacherAttendance({ userRole, diaSemanaEcuador, loadReportSummary }: UseTeacherAttendanceInput) {
  const [estadoAsistencia, setEstadoAsistencia] = useState<EstadoAsistenciaActual | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [docenteHorariosHoy, setDocenteHorariosHoy] = useState<HorarioItem[]>([]);
  const [docenteHistorial, setDocenteHistorial] = useState<AsistenciaItem[]>([]);
  const [docentePanelError, setDocentePanelError] = useState('');
  const [justificacionText, setJustificacionText] = useState('');
  const [justificacionRegistroId, setJustificacionRegistroId] = useState<string | null>(null);

  const loadEstadoAsistencia = useCallback(async () => {
    if (userRole !== 'docente') return;

    try {
      const { data } = await api.get('/asistencias/estado-actual');
      setEstadoAsistencia(data.data);
    } catch (error) {
      setAttendanceError(getApiMessage(error, 'No se pudo obtener el estado de asistencia.'));
    }
  }, [userRole]);

  useEffect(() => {
    void loadEstadoAsistencia();
    if (userRole !== 'docente') return undefined;

    const intervalId = window.setInterval(() => {
      void loadEstadoAsistencia();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [loadEstadoAsistencia, userRole]);

  const loadDocentePanel = useCallback(async () => {
    if (userRole !== 'docente') return;

    setDocentePanelError('');

    try {
      const horariosRequest =
        diaSemanaEcuador === 'domingo'
          ? Promise.resolve({ data: { data: [] } })
          : api.get(`/horarios?activo=true&dia_semana=${diaSemanaEcuador}`);
      const [horariosResponse, asistenciasResponse] = await Promise.all([horariosRequest, api.get('/asistencias')]);
      setDocenteHorariosHoy(horariosResponse.data.data as HorarioItem[]);
      setDocenteHistorial((asistenciasResponse.data.data as AsistenciaItem[]).slice(0, 6));
    } catch (error) {
      setDocentePanelError(getApiMessage(error, 'No se pudo cargar el panel docente.'));
    }
  }, [diaSemanaEcuador, userRole]);

  useEffect(() => {
    void loadDocentePanel();
    if (userRole !== 'docente') return undefined;

    const intervalId = window.setInterval(() => {
      void loadDocentePanel();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [loadDocentePanel, userRole]);

  const markAttendance = async (type: 'entrada' | 'salida', fotoBase64?: string) => {
    setAttendanceLoading(true);
    setAttendanceError('');
    setAttendanceMessage('');

    try {
      const location = await getBrowserLocation();
      const { data } = await api.post(`/asistencias/${type}`, {
        ...location,
        ...(fotoBase64 ? { foto_base64: fotoBase64 } : {}),
      });
      setAttendanceMessage(data.message);
      await loadEstadoAsistencia();
      await loadDocentePanel();
      await loadReportSummary();
    } catch (error) {
      setAttendanceError(getApiMessage(error, 'No se pudo registrar la asistencia.'));
    } finally {
      setAttendanceLoading(false);
    }
  };

  const sendJustificacion = async () => {
    if (!justificacionRegistroId) return;

    setAttendanceLoading(true);
    setAttendanceError('');
    setAttendanceMessage('');

    try {
      const endpoint = justificacionRegistroId.startsWith('horario:')
        ? `/asistencias/horario/${justificacionRegistroId.replace('horario:', '')}/justificacion`
        : `/asistencias/${justificacionRegistroId}/justificacion`;
      const { data } = await api.post(endpoint, { justificacion: justificacionText });
      setAttendanceMessage(data.message ?? 'Justificación enviada correctamente.');
      setJustificacionRegistroId(null);
      setJustificacionText('');
      await loadEstadoAsistencia();
      await loadDocentePanel();
      await loadReportSummary();
    } catch (error) {
      setAttendanceError(getApiMessage(error, 'No se pudo enviar la justificación.'));
    } finally {
      setAttendanceLoading(false);
    }
  };

  return {
    estadoAsistencia,
    attendanceMessage,
    attendanceError,
    attendanceLoading,
    docenteHorariosHoy,
    docenteHistorial,
    docentePanelError,
    justificacionText,
    setJustificacionText,
    justificacionRegistroId,
    setJustificacionRegistroId,
    markAttendance,
    sendJustificacion,
  };
}
