import { useEffect, useRef, useState } from 'react';
import api from '../../../lib/axios';
import { getApiMessage } from '../../../lib/apiError';
import type { ScheduleGroup } from '../scheduleGroups';
import type { DocenteOption, JornadaBloqueForm, JornadaForm, MateriaOption, PeriodoAcademicoOption } from '../types';

type UseScheduleManagementParams = {
  materias: MateriaOption[];
  docentes: DocenteOption[];
  periodosAcademicos: PeriodoAcademicoOption[];
  loadAdminData: () => Promise<void>;
  loadReportSummary: () => Promise<void>;
};

let bloqueSeq = 0;
function nuevoBloque(dia = 'lunes', inicio = '08:00', fin = '10:00'): JornadaBloqueForm {
  bloqueSeq += 1;
  return { key: `nuevo-${bloqueSeq}`, dia_semana: dia, hora_inicio: inicio, hora_fin: fin };
}

function initialJornadaForm(): JornadaForm {
  return {
    materia_id: '',
    docente_id: '',
    periodo_academico_id: '',
    jornada: 'matutina',
    paralelo: 'A',
    modalidad: 'virtual',
    url_aula_virtual: '',
    bloques: [nuevoBloque()],
  };
}

/** Formulario y acciones de la jornada semanal: todos los bloques de una materia a la vez. */
export function useScheduleManagement({
  materias,
  docentes,
  periodosAcademicos,
  loadAdminData,
  loadReportSummary,
}: UseScheduleManagementParams) {
  const [jornadaForm, setJornadaForm] = useState<JornadaForm>(initialJornadaForm);
  /** Jornada en edición: su asignación, o `null` si es un horario antiguo sin asignación. */
  const [editingJornada, setEditingJornada] = useState<{ asignacionId: string | null } | null>(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  // Cada vez que llegan datos de referencia, completa la materia, el docente y
  // el período (por defecto el activo) que el usuario aún no eligió.
  useEffect(() => {
    setJornadaForm((current) => ({
      ...current,
      materia_id: current.materia_id || materias[0]?.id || '',
      docente_id: current.docente_id || docentes[0]?.id || '',
      periodo_academico_id:
        current.periodo_academico_id || periodosAcademicos.find((periodo) => periodo.activo)?.id || '',
    }));
  }, [materias, docentes, periodosAcademicos]);

  const addBloque = () => {
    setJornadaForm((current) => {
      const ultimo = current.bloques[current.bloques.length - 1];
      return { ...current, bloques: [...current.bloques, nuevoBloque(ultimo?.dia_semana ?? 'lunes', ultimo?.hora_inicio, ultimo?.hora_fin)] };
    });
  };

  const updateBloque = (key: string, changes: Partial<Omit<JornadaBloqueForm, 'key' | 'id'>>) => {
    setJornadaForm((current) => ({
      ...current,
      bloques: current.bloques.map((bloque) => (bloque.key === key ? { ...bloque, ...changes } : bloque)),
    }));
  };

  const removeBloque = (key: string) => {
    setJornadaForm((current) => ({ ...current, bloques: current.bloques.filter((bloque) => bloque.key !== key) }));
  };

  const resetForm = () => {
    setEditingJornada(null);
    setJornadaForm((current) => ({
      ...initialJornadaForm(),
      materia_id: current.materia_id,
      docente_id: current.docente_id,
      periodo_academico_id: current.periodo_academico_id,
    }));
  };

  const saveJornada = async () => {
    setAdminLoading(true);
    setAdminError('');
    setAdminMessage('');

    try {
      const payload = {
        materia_id: jornadaForm.materia_id,
        docente_id: jornadaForm.docente_id,
        periodo_academico_id: jornadaForm.periodo_academico_id,
        jornada: jornadaForm.jornada,
        paralelo: jornadaForm.paralelo,
        modalidad: jornadaForm.modalidad,
        url_aula_virtual: jornadaForm.url_aula_virtual.trim() || undefined,
        bloques: jornadaForm.bloques.map(({ id, dia_semana, hora_inicio, hora_fin }) => ({ id, dia_semana, hora_inicio, hora_fin })),
      };
      const asignacionId = editingJornada?.asignacionId;
      const { data } = asignacionId
        ? await api.put(`/horarios/jornadas/${asignacionId}`, payload)
        : await api.post('/horarios/jornadas', payload);
      setAdminMessage(data.message ?? 'Jornada guardada correctamente.');
      resetForm();
      await loadAdminData();
      await loadReportSummary();
    } catch (error) {
      setAdminError(getApiMessage(error, 'No se pudo guardar la jornada.'));
    } finally {
      setAdminLoading(false);
    }
  };

  const editJornada = (group: ScheduleGroup) => {
    const { principal } = group;
    setAdminMessage('');
    setAdminError('');
    setEditingJornada({ asignacionId: group.asignacionId });
    setJornadaForm({
      materia_id: principal.materia_id,
      docente_id: principal.docente_id ?? '',
      periodo_academico_id: principal.periodo_academico_id ?? '',
      jornada: principal.jornada ?? 'matutina',
      paralelo: principal.asignacion_docente?.paralelo ?? 'A',
      modalidad: principal.modalidad,
      url_aula_virtual: principal.url_aula_virtual ?? '',
      bloques: group.horarios.map((horario) => ({
        key: horario.id,
        id: horario.id,
        dia_semana: horario.dia_semana,
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
      })),
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const deactivateJornada = async (group: ScheduleGroup) => {
    const bloques = group.horarios.length;
    if (!window.confirm(`Confirme que desea desactivar esta jornada (${bloques} ${bloques === 1 ? 'bloque' : 'bloques'}).`)) return;

    setAdminLoading(true);
    setAdminError('');
    setAdminMessage('');

    try {
      if (group.asignacionId) {
        const { data } = await api.delete(`/horarios/jornadas/${group.asignacionId}`);
        setAdminMessage(data.message ?? 'Jornada desactivada correctamente.');
      } else {
        // Horario antiguo sin asignación: se desactiva individualmente.
        await Promise.all(group.horarios.map((horario) => api.delete(`/horarios/${horario.id}`)));
        setAdminMessage('Horario desactivado correctamente.');
      }
      if (editingJornada && editingJornada.asignacionId === group.asignacionId) resetForm();
      await loadAdminData();
      await loadReportSummary();
    } catch (error) {
      setAdminError(getApiMessage(error, 'No se pudo desactivar la jornada.'));
    } finally {
      setAdminLoading(false);
    }
  };

  return {
    jornadaForm,
    setJornadaForm,
    editingJornada,
    adminMessage,
    adminError,
    adminLoading,
    formRef,
    addBloque,
    updateBloque,
    removeBloque,
    saveJornada,
    editJornada,
    cancelJornadaEdit: resetForm,
    deactivateJornada,
  };
}
