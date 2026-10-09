import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/axios';
import type { ReportSummary } from '../types';

/**
 * Resumen de asistencia del día actual para las tarjetas del panel. Es
 * independiente de los filtros de Reportes: sin fechas, la API devuelve el día
 * de hoy en Ecuador, limitado a lo que el rol del usuario puede ver.
 */
export function useTodaySummary(enabled: boolean) {
  const [todaySummary, setTodaySummary] = useState<ReportSummary | null>(null);

  const loadTodaySummary = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data } = await api.get('/reportes/resumen?tipo=docente');
      setTodaySummary(data.data);
    } catch {
      // Las tarjetas son informativas: si falla, se conservan los últimos valores.
    }
  }, [enabled]);

  useEffect(() => {
    void loadTodaySummary();

    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void loadTodaySummary();
    };
    const intervalId = window.setInterval(refreshVisible, 30_000);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [loadTodaySummary]);

  return { todaySummary, loadTodaySummary };
}
