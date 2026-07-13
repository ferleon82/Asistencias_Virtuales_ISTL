import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';
import api from '../../../lib/axios';
import type { HorarioItem, MateriaOption, PeriodoAcademicoOption, ReportSummary } from '../types';

function getApiMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface UseReportsInput {
  materias: MateriaOption[];
  horarios: HorarioItem[];
  periodosAcademicos: PeriodoAcademicoOption[];
}

export function useReports({ materias, horarios, periodosAcademicos }: UseReportsInput) {
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [reportError, setReportError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFrom, setReportFrom] = useState(() => todayIso());
  const [reportTo, setReportTo] = useState(() => todayIso());
  const [reportCarreraId, setReportCarreraId] = useState('');
  const [reportMateriaId, setReportMateriaId] = useState('');
  const [reportDocenteId, setReportDocenteId] = useState('');
  const [reportEstado, setReportEstado] = useState('');
  const [reportCiclo, setReportCiclo] = useState('');
  const [reportPeriodoAcademicoId, setReportPeriodoAcademicoId] = useState('');
  const [datesInitializedFromPeriod, setDatesInitializedFromPeriod] = useState(false);

  const reportMaterias = useMemo(
    () => (reportCarreraId ? materias.filter((materia) => materia.carrera_id === reportCarreraId) : materias),
    [materias, reportCarreraId]
  );

  const reportCiclos = useMemo(
    () => Array.from(new Set(horarios.map((horario) => horario.ciclo))).filter(Boolean),
    [horarios]
  );

  const periodoActivo = useMemo(() => {
    const today = todayIso();
    return (
      periodosAcademicos.find(
        (periodo) => periodo.activo && periodo.fecha_inicio.slice(0, 10) <= today && periodo.fecha_fin.slice(0, 10) >= today
      ) ??
      periodosAcademicos.find((periodo) => periodo.activo) ??
      null
    );
  }, [periodosAcademicos]);

  useEffect(() => {
    if (!periodoActivo || reportPeriodoAcademicoId) return;

    setReportPeriodoAcademicoId(periodoActivo.id);
    setReportFrom(periodoActivo.fecha_inicio.slice(0, 10));
    setReportTo(todayIso());
    setDatesInitializedFromPeriod(true);
  }, [periodoActivo, reportPeriodoAcademicoId]);

  useEffect(() => {
    if (!reportPeriodoAcademicoId || datesInitializedFromPeriod) return;

    const periodo = periodosAcademicos.find((item) => item.id === reportPeriodoAcademicoId);
    if (!periodo) return;

    setReportFrom(periodo.fecha_inicio.slice(0, 10));
    setReportTo(todayIso());
    setDatesInitializedFromPeriod(true);
  }, [datesInitializedFromPeriod, periodosAcademicos, reportPeriodoAcademicoId]);

  const updateReportPeriodoAcademicoId = useCallback((value: SetStateAction<string>) => {
    setReportPeriodoAcademicoId(value);
    setDatesInitializedFromPeriod(false);
  }, []);

  const resetReportFilters = useCallback(() => {
    setReportCarreraId('');
    setReportMateriaId('');
    setReportDocenteId('');
    setReportEstado('');
    setReportCiclo('');

    if (periodoActivo) {
      setReportPeriodoAcademicoId(periodoActivo.id);
      setReportFrom(periodoActivo.fecha_inicio.slice(0, 10));
      setReportTo(todayIso());
      setDatesInitializedFromPeriod(true);
      return;
    }

    setReportPeriodoAcademicoId('');
    setReportFrom(todayIso());
    setReportTo(todayIso());
    setDatesInitializedFromPeriod(false);
  }, [periodoActivo]);

  const buildReportParams = useCallback(() => {
    const params = new URLSearchParams();
    if (reportFrom) params.set('fecha_inicio', reportFrom);
    if (reportTo) params.set('fecha_fin', reportTo);
    if (reportCarreraId) params.set('carrera_id', reportCarreraId);
    if (reportMateriaId) params.set('materia_id', reportMateriaId);
    if (reportDocenteId) params.set('docente_id', reportDocenteId);
    if (reportEstado) params.set('estado', reportEstado);
    if (reportCiclo) params.set('ciclo', reportCiclo);
    if (reportPeriodoAcademicoId) params.set('periodo_academico_id', reportPeriodoAcademicoId);
    return params;
  }, [
    reportCarreraId,
    reportCiclo,
    reportDocenteId,
    reportEstado,
    reportFrom,
    reportMateriaId,
    reportPeriodoAcademicoId,
    reportTo,
  ]);

  const loadReportSummary = useCallback(async () => {
    setReportError('');

    try {
      const params = buildReportParams();
      const { data } = await api.get(`/reportes/resumen?${params.toString()}`);
      setReportSummary(data.data);
    } catch (error) {
      setReportError(getApiMessage(error, 'No se pudo cargar el resumen de reportes.'));
    }
  }, [buildReportParams]);

  useEffect(() => {
    void loadReportSummary();
  }, [loadReportSummary]);

  useEffect(() => {
    if (reportMateriaId && reportCarreraId && !reportMaterias.some((materia) => materia.id === reportMateriaId)) {
      setReportMateriaId('');
    }
  }, [reportCarreraId, reportMateriaId, reportMaterias]);

  const reviewJustificacion = async (id: string, action: 'aprobar' | 'rechazar') => {
    setReportLoading(true);
    setReportError('');

    try {
      await api.post(`/asistencias/${id}/justificacion/${action}`);
      await loadReportSummary();
    } catch (error) {
      setReportError(getApiMessage(error, 'No se pudo procesar la justificación.'));
    } finally {
      setReportLoading(false);
    }
  };

  const downloadReport = async (type: 'pdf' | 'excel') => {
    setReportLoading(true);
    setReportError('');

    try {
      const params = buildReportParams();
      const response = await api.get(`/reportes/${type}?${params.toString()}`, {
        responseType: 'blob',
      });
      const extension = type === 'excel' ? 'xlsx' : 'pdf';
      const mime =
        type === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf';
      const blob = new Blob([response.data], { type: mime });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `reporte-asistencias-${reportFrom}-${reportTo}.${extension}`;
      link.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      setReportError(getApiMessage(error, 'No se pudo descargar el reporte.'));
    } finally {
      setReportLoading(false);
    }
  };

  return {
    reportSummary,
    reportError,
    reportLoading,
    reportFrom,
    setReportFrom,
    reportTo,
    setReportTo,
    reportCarreraId,
    setReportCarreraId,
    reportMateriaId,
    setReportMateriaId,
    reportDocenteId,
    setReportDocenteId,
    reportEstado,
    setReportEstado,
    reportCiclo,
    setReportCiclo,
    reportPeriodoAcademicoId,
    setReportPeriodoAcademicoId: updateReportPeriodoAcademicoId,
    periodosAcademicos,
    reportMaterias,
    reportCiclos,
    resetReportFilters,
    loadReportSummary,
    reviewJustificacion,
    downloadReport,
  };
}
