import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import api from '../../../lib/axios';
import type {
  CarreraOption,
  DocenteOption,
  HorarioForm,
  HorarioItem,
  MateriaForm,
  MateriaOption,
  PeriodoAcademicoOption,
} from '../types';

type UseAdminDataParams = {
  canManageSchedules: boolean;
  setAdminError: (message: string) => void;
  setHorarioForm: Dispatch<SetStateAction<HorarioForm>>;
  setMateriaForm: Dispatch<SetStateAction<MateriaForm>>;
};

function getApiMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export function useAdminData({
  canManageSchedules,
  setAdminError,
  setHorarioForm,
  setMateriaForm,
}: UseAdminDataParams) {
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [materias, setMaterias] = useState<MateriaOption[]>([]);
  const [docentes, setDocentes] = useState<DocenteOption[]>([]);
  const [horarios, setHorarios] = useState<HorarioItem[]>([]);
  const [periodosAcademicos, setPeriodosAcademicos] = useState<PeriodoAcademicoOption[]>([]);

  const loadAdminData = useCallback(async () => {
    setAdminError('');

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
      const docentesData = docentesResponse.data.data as DocenteOption[];
      const periodosData = periodosResponse.data.data as PeriodoAcademicoOption[];

      setCarreras(carrerasData);
      setMaterias(materiasData);
      setDocentes(docentesData);
      setPeriodosAcademicos(periodosData);
      setHorarios(horariosResponse.data.data);

      setHorarioForm((current) => {
        const selectedPeriodo =
          periodosData.find((periodo) => periodo.id === current.periodo_academico_id) ??
          periodosData.find((periodo) => periodo.activo);

        return {
          ...current,
          materia_id: current.materia_id || materiasData[0]?.id || '',
          docente_id: current.docente_id || docentesData[0]?.id || '',
          periodo_academico_id: current.periodo_academico_id || selectedPeriodo?.id || '',
          ciclo: selectedPeriodo?.codigo ?? current.ciclo,
          fecha_inicio_ciclo: selectedPeriodo?.fecha_inicio.slice(0, 10) ?? current.fecha_inicio_ciclo,
          fecha_fin_ciclo: selectedPeriodo?.fecha_fin.slice(0, 10) ?? current.fecha_fin_ciclo,
        };
      });
      setMateriaForm((current) => ({
        ...current,
        carrera_id: current.carrera_id || carrerasData[0]?.id || '',
        docente_id: current.docente_id,
        ciclo: current.ciclo || 1,
      }));
    } catch (error) {
      setAdminError(getApiMessage(error, 'No se pudo cargar la información administrativa.'));
    }
  }, [canManageSchedules, setAdminError, setHorarioForm, setMateriaForm]);

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
    loadAdminData,
  };
}
