import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { AcademicSection } from './dashboard/AcademicSection';
import { AnalyticsDashboard } from './dashboard/AnalyticsDashboard';
import { CameraCaptureModal } from './dashboard/CameraCaptureModal';
import { DashboardFooter } from './dashboard/DashboardFooter';
import { KpiCard } from './dashboard/KpiCard';
import { ModulePermissionsSection } from './dashboard/ModulePermissionsSection';
import { ReportsSection } from './dashboard/ReportsSection';
import { SchedulesSection } from './dashboard/SchedulesSection';
import { SystemSettingsSection } from './dashboard/SystemSettingsSection';
import { SystemStatusCard } from './dashboard/SystemStatusCard';
import { TeacherDaySection } from './dashboard/TeacherDaySection';
import { UsersSection } from './dashboard/UsersSection';
import { rolColors, rolLabels } from './dashboard/constants';
import { useAdminData } from './dashboard/hooks/useAdminData';
import { useModulePermissions } from './dashboard/hooks/useModulePermissions';
import { useReports } from './dashboard/hooks/useReports';
import { useSystemSettings } from './dashboard/hooks/useSystemSettings';
import { useTeacherAttendance } from './dashboard/hooks/useTeacherAttendance';
import { useUsers } from './dashboard/hooks/useUsers';
import type {
  CarreraForm,
  CarreraOption,
  HorarioForm,
  HorarioItem,
  MateriaForm,
  MateriaOption,
  PeriodoAcademicoForm,
  PeriodoAcademicoOption,
} from './dashboard/types';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const hasRectoradoPrivileges = user?.rol === 'rectorado' || user?.rol === 'talento_humano';
  const isFullAdminRole = user?.rol === 'tics' || hasRectoradoPrivileges;
  const {
    groupedPermissions,
    modulePermissionsLoading,
    modulePermissionsMessage,
    modulePermissionsError,
    hasModule,
    togglePermission,
    savePermissions,
  } = useModulePermissions(user?.rol);
  const {
    systemSettings,
    systemSettingsLoading,
    systemSettingsMessage,
    systemSettingsError,
    setSystemSettings,
    updateSystemSettings,
  } = useSystemSettings(user?.rol);
  const canViewTeacherAttendance = user?.rol === 'docente' && hasModule('teacher_attendance');
  const canViewTeacherDay = user?.rol === 'docente' && hasModule('teacher_day');
  const canViewInstitutionalAnalytics = hasModule('analytics');
  const canManageUsers = hasModule('users');
  const canManageAcademic = hasModule('academic');
  const canManageSchedules = hasModule('schedules');
  const canViewReports = hasModule('reports');
  const canViewSystemStatus = hasModule('system_status');
  const canConfigureModules = user?.rol === 'tics' && hasModule('module_permissions');
  const canLoadReferenceData = canViewInstitutionalAnalytics || canManageAcademic || canManageSchedules || canViewReports;
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [horarioForm, setHorarioForm] = useState<HorarioForm>(() => ({
    materia_id: '',
    docente_id: '',
    periodo_academico_id: '',
    dia_semana: 'lunes',
    hora_inicio: '08:00',
    hora_fin: '10:00',
    ciclo: '2026-I',
    jornada: 'matutina',
    modalidad: 'virtual',
    fecha_inicio_ciclo: new Date().toISOString().slice(0, 10),
    fecha_fin_ciclo: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().slice(0, 10),
    url_aula_virtual: '',
  }));
  const [editingHorarioId, setEditingHorarioId] = useState<string | null>(null);
  const [academicMessage, setAcademicMessage] = useState('');
  const [academicError, setAcademicError] = useState('');
  const [academicLoading, setAcademicLoading] = useState(false);
  const [carreraForm, setCarreraForm] = useState<CarreraForm>(() => ({
    nombre: '',
    codigo: '',
    coordinador_id: '',
    activa: true,
  }));
  const [editingCarreraId, setEditingCarreraId] = useState<string | null>(null);
  const [materiaForm, setMateriaForm] = useState<MateriaForm>(() => ({
    nombre: '',
    codigo: '',
    carrera_id: '',
    docente_id: '',
    ciclo: 1,
    creditos: 3,
    activa: true,
  }));
  const [editingMateriaId, setEditingMateriaId] = useState<string | null>(null);
  const [periodoForm, setPeriodoForm] = useState<PeriodoAcademicoForm>(() => ({
    nombre: '',
    codigo: '',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().slice(0, 10),
    activo: true,
  }));
  const [editingPeriodoId, setEditingPeriodoId] = useState<string | null>(null);
  const [cameraAction, setCameraAction] = useState<'entrada' | 'salida' | null>(null);
  const [activeModuleTab, setActiveModuleTab] = useState('');
  const { carreras, materias, docentes, periodosAcademicos, horarios, loadAdminData } = useAdminData({
    canManageSchedules: canLoadReferenceData,
    setAdminError,
    setHorarioForm,
    setMateriaForm,
  });
  const {
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
    setReportPeriodoAcademicoId,
    reportMaterias,
    reportCiclos,
    resetReportFilters,
    loadReportSummary,
    reviewJustificacion,
    downloadReport,
  } = useReports({ materias, horarios, periodosAcademicos });
  const now = new Date();
  const hora = now.toLocaleTimeString('es-EC', {
    timeZone: 'America/Guayaquil',
    hour: '2-digit',
    minute: '2-digit',
  });
  const fecha = now.toLocaleDateString('es-EC', {
    timeZone: 'America/Guayaquil',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const fechaPanel = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  const diaSemanaEcuador = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    weekday: 'long',
  })
    .format(now)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const {
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
  } = useTeacherAttendance({
    userRole: user?.rol,
    diaSemanaEcuador,
    loadReportSummary,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const refreshInstitutionalData = useCallback(async () => {
    await Promise.all([loadAdminData(), loadReportSummary()]);
  }, [loadAdminData, loadReportSummary]);

  const {
    usuarios,
    filteredUsuarios,
    usuarioMessage,
    usuarioError,
    usuarioLoading,
    editingUsuarioId,
    usuarioRolFilter,
    setUsuarioRolFilter,
    usuarioForm,
    setUsuarioForm,
    saveUsuario,
    resetUsuarioForm,
    editUsuario,
    toggleUsuarioActivo,
    resetUsuarioPassword,
  } = useUsers(canManageUsers, refreshInstitutionalData);

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
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo crear el horario.';
      setAdminError(message);
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
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo desactivar el horario.';
      setAdminError(message);
    } finally {
      setAdminLoading(false);
    }
  };

  const saveCarrera = async () => {
    setAcademicLoading(true);
    setAcademicError('');
    setAcademicMessage('');

    try {
      const payload = {
        ...carreraForm,
        coordinador_id: carreraForm.coordinador_id || (editingCarreraId ? null : undefined),
        codigo: carreraForm.codigo.toUpperCase(),
      };
      const { data } = editingCarreraId
        ? await api.put(`/admin/carreras/${editingCarreraId}`, payload)
        : await api.post('/admin/carreras', payload);
      setAcademicMessage(data.message ?? (editingCarreraId ? 'Carrera actualizada correctamente.' : 'Carrera creada correctamente.'));
      setCarreraForm({ nombre: '', codigo: '', coordinador_id: '', activa: true });
      setEditingCarreraId(null);
      await loadAdminData();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo guardar la carrera.';
      setAcademicError(message);
    } finally {
      setAcademicLoading(false);
    }
  };

  const editCarrera = (carrera: CarreraOption) => {
    setAcademicMessage('');
    setAcademicError('');
    setEditingCarreraId(carrera.id);
    setCarreraForm({
      nombre: carrera.nombre,
      codigo: carrera.codigo,
      coordinador_id: carrera.coordinador_id ?? carrera.coordinador?.id ?? '',
      activa: carrera.activa ?? true,
    });
  };

  const cancelCarreraEdit = () => {
    setEditingCarreraId(null);
    setCarreraForm({ nombre: '', codigo: '', coordinador_id: '', activa: true });
  };

  const deleteCarrera = async (id: string) => {
    if (!window.confirm('Confirme que desea eliminar esta carrera. También se desactivarán sus materias y horarios.')) return;

    setAcademicLoading(true);
    setAcademicError('');
    setAcademicMessage('');

    try {
      const { data } = await api.delete(`/admin/carreras/${id}`);
      setAcademicMessage(data.message ?? 'Carrera eliminada correctamente.');
      if (editingCarreraId === id) cancelCarreraEdit();
      await loadAdminData();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo eliminar la carrera.';
      setAcademicError(message);
    } finally {
      setAcademicLoading(false);
    }
  };

  const savePeriodoAcademico = async () => {
    setAcademicLoading(true);
    setAcademicError('');
    setAcademicMessage('');

    try {
      const payload = {
        ...periodoForm,
        codigo: periodoForm.codigo.toUpperCase(),
      };
      const { data } = editingPeriodoId
        ? await api.put(`/admin/periodos-academicos/${editingPeriodoId}`, payload)
        : await api.post('/admin/periodos-academicos', payload);
      setAcademicMessage(
        data.message ?? (editingPeriodoId ? 'Período académico actualizado correctamente.' : 'Período académico creado correctamente.')
      );
      setPeriodoForm({
        nombre: '',
        codigo: '',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().slice(0, 10),
        activo: true,
      });
      setEditingPeriodoId(null);
      await loadAdminData();
      await loadReportSummary();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo guardar el período académico.';
      setAcademicError(message);
    } finally {
      setAcademicLoading(false);
    }
  };

  const editPeriodoAcademico = (periodo: PeriodoAcademicoOption) => {
    setAcademicMessage('');
    setAcademicError('');
    setEditingPeriodoId(periodo.id);
    setPeriodoForm({
      nombre: periodo.nombre,
      codigo: periodo.codigo,
      fecha_inicio: periodo.fecha_inicio.slice(0, 10),
      fecha_fin: periodo.fecha_fin.slice(0, 10),
      activo: periodo.activo,
    });
  };

  const cancelPeriodoEdit = () => {
    setEditingPeriodoId(null);
    setPeriodoForm({
      nombre: '',
      codigo: '',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().slice(0, 10),
      activo: true,
    });
  };

  const deletePeriodoAcademico = async (id: string) => {
    if (!window.confirm('Confirme que desea desactivar este período académico.')) return;

    setAcademicLoading(true);
    setAcademicError('');
    setAcademicMessage('');

    try {
      const { data } = await api.delete(`/admin/periodos-academicos/${id}`);
      setAcademicMessage(data.message ?? 'Período académico desactivado correctamente.');
      if (editingPeriodoId === id) cancelPeriodoEdit();
      await loadAdminData();
      await loadReportSummary();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo desactivar el período académico.';
      setAcademicError(message);
    } finally {
      setAcademicLoading(false);
    }
  };

  const saveMateria = async () => {
    setAcademicLoading(true);
    setAcademicError('');
    setAcademicMessage('');

    try {
      const payload = {
        ...materiaForm,
        docente_id: materiaForm.docente_id || (editingMateriaId ? null : undefined),
        codigo: materiaForm.codigo.toUpperCase(),
      };
      const { data } = editingMateriaId
        ? await api.put(`/admin/materias/${editingMateriaId}`, payload)
        : await api.post('/admin/materias', payload);
      setAcademicMessage(data.message ?? (editingMateriaId ? 'Materia actualizada correctamente.' : 'Materia creada correctamente.'));
      setEditingMateriaId(null);
      setMateriaForm((current) => ({
        nombre: '',
        codigo: '',
        carrera_id: current.carrera_id,
        docente_id: current.docente_id,
        ciclo: current.ciclo,
        creditos: 3,
        activa: true,
      }));
      await loadAdminData();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo guardar la materia.';
      setAcademicError(message);
    } finally {
      setAcademicLoading(false);
    }
  };

  const editMateria = (materia: MateriaOption) => {
    setAcademicMessage('');
    setAcademicError('');
    setEditingMateriaId(materia.id);
    setMateriaForm({
      nombre: materia.nombre,
      codigo: materia.codigo,
      carrera_id: materia.carrera_id,
      docente_id: materia.docente_id ?? materia.docente?.id ?? '',
      ciclo: materia.ciclo,
      creditos: materia.creditos ?? 3,
      activa: materia.activa ?? true,
    });
  };

  const cancelMateriaEdit = () => {
    setEditingMateriaId(null);
    setMateriaForm((current) => ({
      nombre: '',
      codigo: '',
      carrera_id: current.carrera_id || carreras[0]?.id || '',
      docente_id: current.docente_id,
      ciclo: current.ciclo,
      creditos: 3,
      activa: true,
    }));
  };

  const deleteMateria = async (id: string) => {
    if (!window.confirm('Confirme que desea eliminar esta materia. También se desactivarán sus horarios.')) return;

    setAcademicLoading(true);
    setAcademicError('');
    setAcademicMessage('');

    try {
      const { data } = await api.delete(`/admin/materias/${id}`);
      setAcademicMessage(data.message ?? 'Materia eliminada correctamente.');
      if (editingMateriaId === id) cancelMateriaEdit();
      await loadAdminData();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo eliminar la materia.';
      setAcademicError(message);
    } finally {
      setAcademicLoading(false);
    }
  };

  const confirmCameraAttendance = async (photoBase64: string) => {
    if (!cameraAction) return;

    await markAttendance(cameraAction, photoBase64);
    setCameraAction(null);
  };

  const handleAttendanceAction = async (action: 'entrada' | 'salida') => {
    if (estadoAsistencia?.attendancePhotoRequired ?? systemSettings.attendance_photo_required) {
      setCameraAction(action);
      return;
    }

    await markAttendance(action);
  };

  const moduleTabs = [
    canViewTeacherAttendance && { key: 'teacher_attendance', label: 'Marcar asistencia' },
    canViewTeacherDay && { key: 'teacher_day', label: 'Mi jornada' },
    canViewInstitutionalAnalytics && { key: 'analytics', label: 'Dashboard' },
    canManageUsers && { key: 'users', label: 'Usuarios' },
    canConfigureModules && { key: 'settings', label: 'Configuración' },
    canManageAcademic && { key: 'academic', label: 'Académico' },
    canManageSchedules && { key: 'schedules', label: 'Horarios' },
    canViewReports && { key: 'reports', label: 'Reportes' },
    canViewSystemStatus && { key: 'system_status', label: 'Estado' },
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  useEffect(() => {
    if (!moduleTabs.length) {
      setActiveModuleTab('');
      return;
    }

    if (!moduleTabs.some((tab) => tab.key === activeModuleTab)) {
      setActiveModuleTab(moduleTabs[0].key);
    }
  }, [activeModuleTab, moduleTabs]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo + nombre */}
            <div className="flex items-center gap-3">
              <img
                src="/brand/istl-icon.png"
                alt="IST-LOJA"
                className="h-10 w-10 object-contain"
              />
              <div>
                <p className="font-brand text-base font-bold text-brand-navy leading-none">IST-LOJA</p>
                <p className="text-xs text-slate-500 leading-none mt-0.5">Asistencia Virtual</p>
              </div>
            </div>

            {/* Usuario */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800">
                  {user?.nombre} {user?.apellido}
                </p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rolColors[user?.rol ?? 'docente']}`}>
                  {rolLabels[user?.rol ?? 'docente']}
                </span>
              </div>
              <button
                onClick={handleLogout}
                id="btn-logout"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
                </svg>
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="mx-auto max-w-7xl px-4 py-6 animate-fade-in sm:px-6 lg:px-8 lg:py-8">
        {/* Bienvenida + Fecha */}
        <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-brand-navy text-white shadow-sm">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase text-istl-200">Panel institucional</p>
              <h1 className="mt-2 font-brand text-3xl font-bold leading-tight sm:text-4xl">
                Hola, {user?.nombre}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
                Gestiona asistencia, horarios y reportes desde una vista ordenada según tu rol.
              </p>
            </div>
            <div className="rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm">
              <p className="text-white">{fechaPanel}</p>
              <p className="mt-1 font-semibold text-istl-100">{hora} hora Ecuador</p>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <KpiCard
            title="Presentes ahora"
            value={reportSummary?.presentes ?? 0}
            subtitle="Con ingreso registrado"
            color="bg-teal-50 text-istl-700"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
              </svg>
            }
          />
          <KpiCard
            title="Tardanzas hoy"
            value={reportSummary?.tardanza ?? 0}
            subtitle="Registradas hasta ahora"
            color="bg-amber-50 text-amber-600"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
              </svg>
            }
          />
          <KpiCard
            title="Ausentes del día"
            value={reportSummary?.ausente ?? 0}
            subtitle="Sin registro de entrada"
            color="bg-red-50 text-red-600"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.476 14.89zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/>
              </svg>
            }
          />
          <KpiCard
            title="Clases del día"
            value={reportSummary?.totalProgramadas ?? 0}
            subtitle="Programadas en total"
            color="bg-istl-50 text-brand-navy"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
              </svg>
            }
          />
        </div>

        {moduleTabs.length > 0 && (
          <nav className="mb-6 rounded-lg border border-slate-200 bg-white p-2 shadow-sm" aria-label="Módulos del sistema">
            <div className="flex gap-2 overflow-x-auto">
              {moduleTabs.map((tab) => {
                const isActive = activeModuleTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveModuleTab(tab.key)}
                    className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-brand-navy text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-brand-navy'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* Panel de acciones rápidas */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Marcar asistencia */}
          {activeModuleTab === 'teacher_attendance' && canViewTeacherAttendance && (
            <div className="rounded-lg bg-brand-navy p-6 text-white shadow-lg lg:col-span-3 xl:col-span-1">
              <h2 className="font-brand text-xl font-bold mb-1">Marcar asistencia</h2>
              <p className="text-slate-200 text-sm mb-5">
                Registre su ingreso o salida de la clase virtual activa.
              </p>
              <div className="mb-4 rounded-md bg-white/10 border border-white/20 p-3">
                <p className="text-xs font-medium text-istl-100">Clase activa</p>
                {estadoAsistencia?.horarioActivo ? (
                  <div className="mt-1">
                    <p className="text-sm font-semibold">{estadoAsistencia.horarioActivo.materia.nombre}</p>
                    <p className="text-xs text-slate-200">
                      {estadoAsistencia.horarioActivo.hora_inicio} - {estadoAsistencia.horarioActivo.hora_fin}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-200">Sin clase dentro de la ventana de marcado.</p>
                )}
                {estadoAsistencia?.registroAbierto && (
                  <div className="mt-2 space-y-1 text-xs text-teal-100">
                    <p>
                      Ingreso abierto: {new Date(estadoAsistencia.registroAbierto.timestamp_entrada ?? '').toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {!estadoAsistencia.puedeMarcarSalida && estadoAsistencia.salidaDisponibleDesde && (
                      <p>
                        Salida disponible desde: {new Date(estadoAsistencia.salidaDisponibleDesde).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {attendanceMessage && (
                <div className="mb-3 rounded-md bg-teal-400/20 border border-teal-300/30 p-3 text-sm text-teal-50">
                  {attendanceMessage}
                </div>
              )}
              {attendanceError && (
                <div className="mb-3 rounded-md bg-red-400/20 border border-red-300/30 p-3 text-sm text-red-50">
                  {attendanceError}
                </div>
              )}
              <div className="space-y-3">
                <button
                  id="btn-marcar-entrada"
                  onClick={() => void handleAttendanceAction('entrada')}
                  disabled={attendanceLoading || !estadoAsistencia?.puedeMarcarEntrada}
                  className="w-full py-3 px-4 rounded-md bg-white text-brand-navy font-semibold text-sm hover:bg-istl-50 disabled:bg-white/40 disabled:cursor-not-allowed transition-colors shadow flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd"/>
                  </svg>
                  {attendanceLoading ? 'Registrando...' : 'Marcar Ingreso'}
                </button>
                <button
                  id="btn-marcar-salida"
                  onClick={() => void handleAttendanceAction('salida')}
                  disabled={attendanceLoading || !estadoAsistencia?.puedeMarcarSalida}
                  title={estadoAsistencia?.salidaBloqueadaMotivo ?? undefined}
                  className="w-full py-3 px-4 rounded-md bg-white/20 text-white font-semibold text-sm hover:bg-white/30 disabled:bg-white/10 disabled:text-white/50 disabled:cursor-not-allowed transition-colors border border-white/30 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
                  </svg>
                  {attendanceLoading ? 'Registrando...' : 'Marcar Salida'}
                </button>
              </div>
            </div>
          )}

          {activeModuleTab === 'system_status' && canViewSystemStatus && (
            <SystemStatusCard className="lg:col-span-3" />
          )}
        </div>

        {activeModuleTab === 'teacher_day' && canViewTeacherDay && (
          <TeacherDaySection
            estadoAsistencia={estadoAsistencia}
            diaSemanaEcuador={diaSemanaEcuador}
            docentePanelError={docentePanelError}
            docenteHorariosHoy={docenteHorariosHoy}
            docenteHistorial={docenteHistorial}
            justificacionRegistroId={justificacionRegistroId}
            setJustificacionRegistroId={setJustificacionRegistroId}
            justificacionText={justificacionText}
            setJustificacionText={setJustificacionText}
            attendanceLoading={attendanceLoading}
            sendJustificacion={sendJustificacion}
          />
        )}

        {activeModuleTab === 'analytics' && canViewInstitutionalAnalytics && (
          <AnalyticsDashboard
            reportSummary={reportSummary}
            reportFrom={reportFrom}
            setReportFrom={setReportFrom}
            reportTo={reportTo}
            setReportTo={setReportTo}
            reportPeriodoAcademicoId={reportPeriodoAcademicoId}
            setReportPeriodoAcademicoId={setReportPeriodoAcademicoId}
            reportCarreraId={reportCarreraId}
            setReportCarreraId={setReportCarreraId}
            reportMateriaId={reportMateriaId}
            setReportMateriaId={setReportMateriaId}
            reportDocenteId={reportDocenteId}
            setReportDocenteId={setReportDocenteId}
            reportEstado={reportEstado}
            setReportEstado={setReportEstado}
            reportCiclo={reportCiclo}
            setReportCiclo={setReportCiclo}
            periodosAcademicos={periodosAcademicos}
            carreras={carreras}
            reportMaterias={reportMaterias}
            docentes={docentes}
            reportCiclos={reportCiclos}
            reportLoading={reportLoading}
            loadReportSummary={loadReportSummary}
            resetReportFilters={resetReportFilters}
            downloadReport={downloadReport}
          />
        )}

        {activeModuleTab === 'users' && canManageUsers && (
          <UsersSection
            usuarios={usuarios}
            filteredUsuarios={filteredUsuarios}
            usuarioForm={usuarioForm}
            setUsuarioForm={setUsuarioForm}
            usuarioMessage={usuarioMessage}
            usuarioError={usuarioError}
            usuarioLoading={usuarioLoading}
            editingUsuarioId={editingUsuarioId}
            usuarioRolFilter={usuarioRolFilter}
            setUsuarioRolFilter={setUsuarioRolFilter}
            saveUsuario={saveUsuario}
            resetUsuarioForm={resetUsuarioForm}
            editUsuario={editUsuario}
            toggleUsuarioActivo={toggleUsuarioActivo}
            resetUsuarioPassword={resetUsuarioPassword}
          />
        )}

        {activeModuleTab === 'settings' && canConfigureModules && (
          <>
            <SystemSettingsSection
              settings={systemSettings}
              loading={systemSettingsLoading}
              message={systemSettingsMessage}
              error={systemSettingsError}
              setSettings={setSystemSettings}
              saveSettings={updateSystemSettings}
            />
            <ModulePermissionsSection
              groupedPermissions={groupedPermissions}
              loading={modulePermissionsLoading}
              message={modulePermissionsMessage}
              error={modulePermissionsError}
              togglePermission={togglePermission}
              savePermissions={savePermissions}
            />
          </>
        )}

        {activeModuleTab === 'academic' && canManageAcademic && (
          <AcademicSection
            canManageUsers={isFullAdminRole}
            carreras={carreras}
            materias={materias}
            docentes={docentes}
            periodosAcademicos={periodosAcademicos}
            carreraForm={carreraForm}
            setCarreraForm={setCarreraForm}
            periodoForm={periodoForm}
            setPeriodoForm={setPeriodoForm}
            materiaForm={materiaForm}
            setMateriaForm={setMateriaForm}
            academicMessage={academicMessage}
            academicError={academicError}
            academicLoading={academicLoading}
            editingCarreraId={editingCarreraId}
            editingPeriodoId={editingPeriodoId}
            editingMateriaId={editingMateriaId}
            saveCarrera={saveCarrera}
            editCarrera={editCarrera}
            cancelCarreraEdit={cancelCarreraEdit}
            deleteCarrera={deleteCarrera}
            savePeriodoAcademico={savePeriodoAcademico}
            editPeriodoAcademico={editPeriodoAcademico}
            cancelPeriodoEdit={cancelPeriodoEdit}
            deletePeriodoAcademico={deletePeriodoAcademico}
            saveMateria={saveMateria}
            editMateria={editMateria}
            cancelMateriaEdit={cancelMateriaEdit}
            deleteMateria={deleteMateria}
          />
        )}

        {activeModuleTab === 'schedules' && canManageSchedules && (
          <SchedulesSection
            carreras={carreras}
            materias={materias}
            docentes={docentes}
            periodosAcademicos={periodosAcademicos}
            horarios={horarios}
            horarioForm={horarioForm}
            setHorarioForm={setHorarioForm}
            adminMessage={adminMessage}
            adminError={adminError}
            adminLoading={adminLoading}
            editingHorarioId={editingHorarioId}
            createHorario={createHorario}
            editHorario={editHorario}
            cancelHorarioEdit={cancelHorarioEdit}
            deactivateHorario={deactivateHorario}
          />
        )}

        {activeModuleTab === 'reports' && canViewReports && (
          <ReportsSection
            reportFrom={reportFrom}
            setReportFrom={setReportFrom}
            reportTo={reportTo}
            setReportTo={setReportTo}
            reportCarreraId={reportCarreraId}
            setReportCarreraId={setReportCarreraId}
            reportMateriaId={reportMateriaId}
            setReportMateriaId={setReportMateriaId}
            reportDocenteId={reportDocenteId}
            setReportDocenteId={setReportDocenteId}
            reportEstado={reportEstado}
            setReportEstado={setReportEstado}
            reportCiclo={reportCiclo}
            setReportCiclo={setReportCiclo}
            reportPeriodoAcademicoId={reportPeriodoAcademicoId}
            setReportPeriodoAcademicoId={setReportPeriodoAcademicoId}
            carreras={carreras}
            periodosAcademicos={periodosAcademicos}
            reportMaterias={reportMaterias}
            docentes={docentes}
            reportCiclos={reportCiclos}
            reportSummary={reportSummary}
            reportError={reportError}
            reportLoading={reportLoading}
            canManageSchedules={canManageSchedules || canManageAcademic}
            userRole={user?.rol}
            downloadReport={downloadReport}
            reviewJustificacion={reviewJustificacion}
          />
        )}

        {cameraAction && (
          <CameraCaptureModal
            action={cameraAction}
            loading={attendanceLoading}
            onCancel={() => setCameraAction(null)}
            onConfirm={(photoBase64) => void confirmCameraAttendance(photoBase64)}
          />
        )}

        <DashboardFooter />
      </main>
    </div>
  );
}
