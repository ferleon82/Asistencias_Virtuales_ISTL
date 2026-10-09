import { useEffect, useState } from 'react';
import api from '../../../lib/axios';
import { getApiMessage } from '../../../lib/apiError';
import type { DocenteOption, HorarioForm, HorarioItem, MateriaOption, PeriodoAcademicoOption } from '../types';

type UseScheduleManagementParams = {
  materias: MateriaOption[];
  docentes: DocenteOption[];
  periodosAcademicos: PeriodoAcademicoOption[];
  loadAdminData: () => Promise<void>;
  loadReportSummary: () => Promise<void>;
};

function initialHorarioForm(): HorarioForm {
  return {
    materia_id: '',
    docente_id: '',
    periodo_academico_id: '',
    dia_semana: 'lunes',
    hora_inicio: '08:00',
    hora_fin: '10:00',
    ciclo: '2026-I',
    jornada: 'matutina',
    paralelo: 'A',
    modalidad: 'virtual',
    fecha_inicio_ciclo: new Date().toISOString().slice(0, 10),
    fecha_fin_ciclo: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().slice(0, 10),
    url_aula_virtual: '',
  };
}

/** Formulario y acciones de la administración de horarios. */
export function useScheduleManagement({
  materias,
  docentes,
  periodosAcademicos,
  loadAdminData,
  loadReportSummary,
}: UseScheduleManagementParams) {
  const [horarioForm, setHorarioForm] = useState<HorarioForm>(initialHorarioForm);
  const [editingHorarioId, setEditingHorarioId] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // Cada vez que llegan datos de referencia, completa la materia, el docente y
  // el período (por defecto el activo) que el usuario aún no eligió.
  useEffect(() => {
    setHorarioForm((current) => {
      const selectedPeriodo =
        periodosAcademicos.find((periodo) => periodo.id === current.periodo_academico_id) ??
        periodosAcademicos.find((periodo) => periodo.activo);

      return {
        ...current,
        materia_id: current.materia_id || materias[0]?.id || '',
        docente_id: current.docente_id || docentes[0]?.id || '',
        periodo_academico_id: current.periodo_academico_id || selectedPeriodo?.id || '',
        ciclo: selectedPeriodo?.codigo ?? current.ciclo,
        fecha_inicio_ciclo: selectedPeriodo?.fecha_inicio.slice(0, 10) ?? current.fecha_inicio_ciclo,
        fecha_fin_ciclo: selectedPeriodo?.fecha_fin.slice(0, 10) ?? current.fecha_fin_ciclo,
      };
    });
  }, [materias, docentes, periodosAcademicos]);

  const createHorario = async () => {
    setAdminLoading(true);
    setAdminError('');
    setAdminMessage('');

    try {
      const payload = {
        ...horarioForm,
        periodo_academico_id: horarioForm.periodo_academico_id || undefined,
        url_aula_virtual: horarioForm.url_aula_virtual || undefined,
      };
      const { data } = editingHorarioId
        ? await api.put(`/horarios/${editingHorarioId}`, payload)
        : await api.post('/horarios', payload);
      setAdminMessage(data.message ?? (editingHorarioId ? 'Horario actualizado correctamente.' : 'Horario creado correctamente.'));
      setEditingHorarioId(null);
      await loadAdminData();
      await loadReportSummary();
    } catch (error) {
      setAdminError(getApiMessage(error, 'No se pudo crear el horario.'));
    } finally {
      setAdminLoading(false);
    }
  };

  const editHorario = (horario: HorarioItem) => {
    setEditingHorarioId(horario.id);
    setAdminMessage('');
    setAdminError('');
    setHorarioForm({
      materia_id: horario.materia_id,
      docente_id: horario.docente_id ?? horario.materia.docente?.id ?? '',
      periodo_academico_id: horario.periodo_academico_id ?? '',
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      hora_fin: horario.hora_fin,
      ciclo: horario.ciclo,
      jornada: horario.jornada ?? 'matutina',
      paralelo: horario.asignacion_docente?.paralelo ?? 'A',
      modalidad: horario.modalidad,
      fecha_inicio_ciclo: horario.fecha_inicio_ciclo.slice(0, 10),
      fecha_fin_ciclo: horario.fecha_fin_ciclo.slice(0, 10),
      url_aula_virtual: horario.url_aula_virtual ?? '',
    });
  };

  const cancelHorarioEdit = () => {
    const activePeriodo = periodosAcademicos.find((periodo) => periodo.activo);

    setEditingHorarioId(null);
    setHorarioForm((current) => ({
      ...current,
      materia_id: materias[0]?.id || current.materia_id,
      docente_id: docentes[0]?.id || current.docente_id,
      periodo_academico_id: activePeriodo?.id || current.periodo_academico_id,
      dia_semana: 'lunes',
      hora_inicio: '08:00',
      hora_fin: '10:00',
      ciclo: activePeriodo?.codigo ?? current.ciclo,
      jornada: 'matutina',
      paralelo: 'A',
      modalidad: 'virtual',
      fecha_inicio_ciclo: activePeriodo?.fecha_inicio.slice(0, 10) ?? current.fecha_inicio_ciclo,
      fecha_fin_ciclo: activePeriodo?.fecha_fin.slice(0, 10) ?? current.fecha_fin_ciclo,
      url_aula_virtual: '',
    }));
  };

  const deactivateHorario = async (id: string) => {
    if (!window.confirm('Confirme que desea desactivar este horario.')) return;

    setAdminLoading(true);
    setAdminError('');
    setAdminMessage('');

    try {
      const { data } = await api.delete(`/horarios/${id}`);
      setAdminMessage(data.message ?? 'Horario desactivado correctamente.');
      if (editingHorarioId === id) {
        setEditingHorarioId(null);
      }
      await loadAdminData();
      await loadReportSummary();
    } catch (error) {
      setAdminError(getApiMessage(error, 'No se pudo desactivar el horario.'));
    } finally {
      setAdminLoading(false);
    }
  };

  return {
    horarioForm,
    setHorarioForm,
    editingHorarioId,
    adminMessage,
    adminError,
    adminLoading,
    createHorario,
    editHorario,
    cancelHorarioEdit,
    deactivateHorario,
  };
}
