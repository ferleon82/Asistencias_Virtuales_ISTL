import { useEffect, useState } from 'react';
import api from '../../../lib/axios';
import { getApiMessage } from '../../../lib/apiError';
import type {
  CarreraForm,
  CarreraOption,
  MateriaForm,
  MateriaOption,
  PeriodoAcademicoForm,
  PeriodoAcademicoOption,
} from '../types';

type UseAcademicManagementParams = {
  carreras: CarreraOption[];
  loadAdminData: () => Promise<void>;
  loadReportSummary: () => Promise<void>;
};

/** Código interno del período a partir de su nombre: "2026 - II" -> "2026_II". */
function buildInternalPeriodCode(nombre: string): string {
  return nombre
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

const emptyCarreraForm = (): CarreraForm => ({ nombre: '', codigo: '', coordinador_id: '', activa: true });

const emptyPeriodoForm = (): PeriodoAcademicoForm => ({
  nombre: '',
  codigo: '',
  fecha_inicio: new Date().toISOString().slice(0, 10),
  fecha_fin: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().slice(0, 10),
  activo: true,
});

/** Formularios y acciones de la gestión académica: carreras, períodos y materias. */
export function useAcademicManagement({ carreras, loadAdminData, loadReportSummary }: UseAcademicManagementParams) {
  const [academicMessage, setAcademicMessage] = useState('');
  const [academicError, setAcademicError] = useState('');
  const [academicLoading, setAcademicLoading] = useState(false);
  const [carreraForm, setCarreraForm] = useState<CarreraForm>(emptyCarreraForm);
  const [editingCarreraId, setEditingCarreraId] = useState<string | null>(null);
  const [materiaForm, setMateriaForm] = useState<MateriaForm>(() => ({
    nombre: '',
    codigo: '',
    carrera_id: '',
    ciclo: 1,
    creditos: 3,
    activa: true,
  }));
  const [editingMateriaId, setEditingMateriaId] = useState<string | null>(null);
  const [periodoForm, setPeriodoForm] = useState<PeriodoAcademicoForm>(emptyPeriodoForm);
  const [editingPeriodoId, setEditingPeriodoId] = useState<string | null>(null);

  // Al llegar las carreras, preselecciona la primera si aún no se eligió una.
  useEffect(() => {
    setMateriaForm((current) => ({
      ...current,
      carrera_id: current.carrera_id || carreras[0]?.id || '',
      ciclo: current.ciclo || 1,
    }));
  }, [carreras]);

  /** Ejecuta una acción mostrando carga, mensaje de éxito o error. */
  const run = async (action: () => Promise<string>, fallbackError: string) => {
    setAcademicLoading(true);
    setAcademicError('');
    setAcademicMessage('');

    try {
      setAcademicMessage(await action());
    } catch (error) {
      setAcademicError(getApiMessage(error, fallbackError));
    } finally {
      setAcademicLoading(false);
    }
  };

  const startEditing = () => {
    setAcademicMessage('');
    setAcademicError('');
  };

  // ─── Carreras ──────────────────────────────────────────────────────────────

  const cancelCarreraEdit = () => {
    setEditingCarreraId(null);
    setCarreraForm(emptyCarreraForm());
  };

  const saveCarrera = () =>
    run(async () => {
      const payload = {
        ...carreraForm,
        coordinador_id: carreraForm.coordinador_id || (editingCarreraId ? null : undefined),
        codigo: carreraForm.codigo.toUpperCase(),
      };
      const { data } = editingCarreraId
        ? await api.put(`/admin/carreras/${editingCarreraId}`, payload)
        : await api.post('/admin/carreras', payload);
      const message = data.message ?? (editingCarreraId ? 'Carrera actualizada correctamente.' : 'Carrera creada correctamente.');
      cancelCarreraEdit();
      await loadAdminData();
      return message;
    }, 'No se pudo guardar la carrera.');

  const editCarrera = (carrera: CarreraOption) => {
    startEditing();
    setEditingCarreraId(carrera.id);
    setCarreraForm({
      nombre: carrera.nombre,
      codigo: carrera.codigo,
      coordinador_id: carrera.coordinador_id ?? carrera.coordinador?.id ?? '',
      activa: carrera.activa ?? true,
    });
  };

  const deleteCarrera = async (id: string) => {
    if (!window.confirm('Confirme que desea eliminar esta carrera. También se desactivarán sus materias y horarios.')) return;

    await run(async () => {
      const { data } = await api.delete(`/admin/carreras/${id}`);
      if (editingCarreraId === id) cancelCarreraEdit();
      await loadAdminData();
      return data.message ?? 'Carrera eliminada correctamente.';
    }, 'No se pudo eliminar la carrera.');
  };

  // ─── Períodos académicos ───────────────────────────────────────────────────

  const cancelPeriodoEdit = () => {
    setEditingPeriodoId(null);
    setPeriodoForm(emptyPeriodoForm());
  };

  const savePeriodoAcademico = () =>
    run(async () => {
      const payload = { ...periodoForm, codigo: buildInternalPeriodCode(periodoForm.nombre) };
      const { data } = editingPeriodoId
        ? await api.put(`/admin/periodos-academicos/${editingPeriodoId}`, payload)
        : await api.post('/admin/periodos-academicos', payload);
      const message =
        data.message ?? (editingPeriodoId ? 'Período académico actualizado correctamente.' : 'Período académico creado correctamente.');
      cancelPeriodoEdit();
      await loadAdminData();
      await loadReportSummary();
      return message;
    }, 'No se pudo guardar el período académico.');

  const editPeriodoAcademico = (periodo: PeriodoAcademicoOption) => {
    startEditing();
    setEditingPeriodoId(periodo.id);
    setPeriodoForm({
      nombre: periodo.nombre,
      codigo: periodo.codigo,
      fecha_inicio: periodo.fecha_inicio.slice(0, 10),
      fecha_fin: periodo.fecha_fin.slice(0, 10),
      activo: periodo.activo,
    });
  };

  const deletePeriodoAcademico = async (id: string) => {
    if (!window.confirm('Confirme que desea desactivar este período académico.')) return;

    await run(async () => {
      const { data } = await api.delete(`/admin/periodos-academicos/${id}`);
      if (editingPeriodoId === id) cancelPeriodoEdit();
      await loadAdminData();
      await loadReportSummary();
      return data.message ?? 'Período académico desactivado correctamente.';
    }, 'No se pudo desactivar el período académico.');
  };

  // ─── Materias ──────────────────────────────────────────────────────────────

  const cancelMateriaEdit = () => {
    setEditingMateriaId(null);
    setMateriaForm((current) => ({
      nombre: '',
      codigo: '',
      carrera_id: current.carrera_id || carreras[0]?.id || '',
      ciclo: current.ciclo,
      creditos: 3,
      activa: true,
    }));
  };

  const saveMateria = () =>
    run(async () => {
      const payload = { ...materiaForm, codigo: materiaForm.codigo.toUpperCase() };
      const { data } = editingMateriaId
        ? await api.put(`/admin/materias/${editingMateriaId}`, payload)
        : await api.post('/admin/materias', payload);
      const message = data.message ?? (editingMateriaId ? 'Materia actualizada correctamente.' : 'Materia creada correctamente.');
      // Conserva carrera y ciclo para registrar varias materias seguidas.
      setEditingMateriaId(null);
      setMateriaForm((current) => ({
        nombre: '',
        codigo: '',
        carrera_id: current.carrera_id,
        ciclo: current.ciclo,
        creditos: 3,
        activa: true,
      }));
      await loadAdminData();
      return message;
    }, 'No se pudo guardar la materia.');

  const editMateria = (materia: MateriaOption) => {
    startEditing();
    setEditingMateriaId(materia.id);
    setMateriaForm({
      nombre: materia.nombre,
      codigo: materia.codigo,
      carrera_id: materia.carrera_id,
      ciclo: materia.ciclo,
      creditos: materia.creditos ?? 3,
      activa: materia.activa ?? true,
    });
  };

  const deleteMateria = async (id: string) => {
    if (!window.confirm('Confirme que desea eliminar esta materia. También se desactivarán sus horarios.')) return;

    await run(async () => {
      const { data } = await api.delete(`/admin/materias/${id}`);
      if (editingMateriaId === id) cancelMateriaEdit();
      await loadAdminData();
      return data.message ?? 'Materia eliminada correctamente.';
    }, 'No se pudo eliminar la materia.');
  };

  return {
    carreraForm,
    setCarreraForm,
    periodoForm,
    setPeriodoForm,
    materiaForm,
    setMateriaForm,
    academicMessage,
    academicError,
    academicLoading,
    editingCarreraId,
    editingPeriodoId,
    editingMateriaId,
    saveCarrera,
    editCarrera,
    cancelCarreraEdit,
    deleteCarrera,
    savePeriodoAcademico,
    editPeriodoAcademico,
    cancelPeriodoEdit,
    deletePeriodoAcademico,
    saveMateria,
    editMateria,
    cancelMateriaEdit,
    deleteMateria,
  };
}
