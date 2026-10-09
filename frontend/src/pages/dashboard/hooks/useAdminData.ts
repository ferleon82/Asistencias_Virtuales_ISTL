import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/axios';
import type {
  CarreraOption,
  DocenteOption,
  HorarioItem,
  MateriaOption,
  PeriodoAcademicoOption,
} from '../types';
import { getApiMessage } from '../../../lib/apiError';

type UseAdminDataParams = {
  canManageSchedules: boolean;
};


/**
 * Datos de referencia del panel (carreras, materias, docentes, períodos y
 * horarios). Se recargan cada 30 s y al volver a la pestaña. Los formularios
 * que dependen de estos datos aplican sus valores por defecto por su cuenta.
 */
export function useAdminData({ canManageSchedules }: UseAdminDataParams) {
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [materias, setMaterias] = useState<MateriaOption[]>([]);
  const [docentes, setDocentes] = useState<DocenteOption[]>([]);
  const [horarios, setHorarios] = useState<HorarioItem[]>([]);
  const [periodosAcademicos, setPeriodosAcademicos] = useState<PeriodoAcademicoOption[]>([]);
  const [loadError, setLoadError] = useState('');

  const loadAdminData = useCallback(async () => {
    setLoadError('');

    try {
      if (!canManageSchedules) {
        const periodosResponse = await api.get('/admin/periodos-academicos');
        setPeriodosAcademicos(periodosResponse.data.data as PeriodoAcademicoOption[]);
        return;
      }

      const [carrerasResponse, materiasResponse, docentesResponse, periodosResponse, horariosResponse] = await Promise.all([
        api.get('/admin/carreras'),
        api.get('/admin/materias'),
        api.get('/admin/docentes'),
        api.get('/admin/periodos-academicos'),
        api.get('/horarios?activo=true'),
      ]);

      const carrerasData = carrerasResponse.data.data as CarreraOption[];
      const materiasData = materiasResponse.data.data as MateriaOption[];
      const docentesData = (docentesResponse.data.data as DocenteOption[]).filter((docente) => docente.rol === 'docente');
      const periodosData = periodosResponse.data.data as PeriodoAcademicoOption[];

      setCarreras(carrerasData);
      setMaterias(materiasData);
      setDocentes(docentesData);
      setPeriodosAcademicos(periodosData);
      setHorarios(horariosResponse.data.data);
    } catch (error) {
      setLoadError(getApiMessage(error, 'No se pudo cargar la información administrativa.'));
    }
  }, [canManageSchedules]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    const refreshVisibleData = () => {
      if (document.visibilityState === 'visible') {
        void loadAdminData();
      }
    };
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadAdminData();
      }
    }, 30_000);

    window.addEventListener('focus', refreshVisibleData);
    document.addEventListener('visibilitychange', refreshVisibleData);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshVisibleData);
      document.removeEventListener('visibilitychange', refreshVisibleData);
    };
  }, [loadAdminData]);

  return {
    carreras,
    materias,
    docentes,
    periodosAcademicos,
    horarios,
    loadError,
    loadAdminData,
  };
}
