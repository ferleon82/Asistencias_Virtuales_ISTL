import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AdministrativeAttendanceCard } from './dashboard/AdministrativeAttendanceCard';
import { DashboardFooter } from './dashboard/DashboardFooter';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { DashboardKpis } from './dashboard/DashboardKpis';
import { DashboardWelcome } from './dashboard/DashboardWelcome';
import { ModuleTabs, type ModuleTab } from './dashboard/ModuleTabs';
import { TeacherAttendanceCard } from './dashboard/TeacherAttendanceCard';
import { useAcademicManagement } from './dashboard/hooks/useAcademicManagement';
import { useAdminData } from './dashboard/hooks/useAdminData';
import { useAdministrativeAttendance } from './dashboard/hooks/useAdministrativeAttendance';
import { useAdministrativeDay } from './dashboard/hooks/useAdministrativeDay';
import { useModulePermissions } from './dashboard/hooks/useModulePermissions';
import { useReports } from './dashboard/hooks/useReports';
import { useScheduleManagement } from './dashboard/hooks/useScheduleManagement';
import { useSystemSettings } from './dashboard/hooks/useSystemSettings';
import { useTeacherAttendance } from './dashboard/hooks/useTeacherAttendance';
import { useUsers } from './dashboard/hooks/useUsers';

// Cada módulo se descarga solo cuando se abre su pestaña: así, por ejemplo,
// la librería de gráficos no se carga para un docente que solo marca asistencia.
const AcademicSection = lazy(() => import('./dashboard/AcademicSection').then((m) => ({ default: m.AcademicSection })));
const AdministrativeDaySection = lazy(() =>
  import('./dashboard/AdministrativeDaySection').then((m) => ({ default: m.AdministrativeDaySection }))
);
const AdministrativeHoursSection = lazy(() =>
  import('./dashboard/AdministrativeHoursSection').then((m) => ({ default: m.AdministrativeHoursSection }))
);
const AnalyticsDashboard = lazy(() => import('./dashboard/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })));
const CameraCaptureModal = lazy(() => import('./dashboard/CameraCaptureModal').then((m) => ({ default: m.CameraCaptureModal })));
const ModulePermissionsSection = lazy(() =>
  import('./dashboard/ModulePermissionsSection').then((m) => ({ default: m.ModulePermissionsSection }))
);
const ReportsSection = lazy(() => import('./dashboard/ReportsSection').then((m) => ({ default: m.ReportsSection })));
const SchedulesSection = lazy(() => import('./dashboard/SchedulesSection').then((m) => ({ default: m.SchedulesSection })));
const SystemSettingsSection = lazy(() =>
  import('./dashboard/SystemSettingsSection').then((m) => ({ default: m.SystemSettingsSection }))
);
const SystemStatusCard = lazy(() => import('./dashboard/SystemStatusCard').then((m) => ({ default: m.SystemStatusCard })));
const TeacherDaySection = lazy(() => import('./dashboard/TeacherDaySection').then((m) => ({ default: m.TeacherDaySection })));
const UsersSection = lazy(() => import('./dashboard/UsersSection').then((m) => ({ default: m.UsersSection })));

function ModuleLoading() {
  return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Cargando módulo...</div>;
}

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
  const canManageAdministrativeHours = user?.rol === 'talento_humano' && hasModule('administrative_hours');
  const canConfigureModules = user?.rol === 'tics' && hasModule('module_permissions');
  const canLoadReferenceData = canViewInstitutionalAnalytics || canManageAcademic || canManageSchedules || canViewReports;
  const [cameraAction, setCameraAction] = useState<{ action: 'entrada' | 'salida'; scope: 'academic' | 'administrative' } | null>(null);
  const [activeModuleTab, setActiveModuleTab] = useState('');
  const { carreras, materias, docentes, periodosAcademicos, horarios, loadError, loadAdminData } = useAdminData({
    canManageSchedules: canLoadReferenceData,
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
    reportType,
    setReportType,
    reportMaterias,
    reportCiclos,
    resetReportFilters,
    loadReportSummary,
    reviewJustificacion,
    downloadReport,
  } = useReports({ materias, periodosAcademicos });
  const schedules = useScheduleManagement({ materias, docentes, periodosAcademicos, loadAdminData, loadReportSummary });
  const academic = useAcademicManagement({ carreras, loadAdminData, loadReportSummary });
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
  const {
    administrativeState,
    administrativeCanMarkExit,
    administrativeLoading,
    administrativeError,
    administrativeMessage,
    markAdministrative,
  } = useAdministrativeAttendance(user?.rol, loadReportSummary);
  const {
    administrativeSchedulesToday,
    administrativeHistory,
    administrativeDayError,
    loadAdministrativeDay,
  } = useAdministrativeDay(user?.rol, diaSemanaEcuador);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const refreshInstitutionalData = useCallback(async () => {
    await Promise.all([loadAdminData(), loadReportSummary(), loadAdministrativeDay()]);
  }, [loadAdminData, loadAdministrativeDay, loadReportSummary]);

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

  const confirmCameraAttendance = async (photoBase64: string) => {
    if (!cameraAction) return;

    if (cameraAction.scope === 'academic') {
      await markAttendance(cameraAction.action, photoBase64);
    } else {
      await markAdministrative(cameraAction.action, photoBase64);
    }
    setCameraAction(null);
  };

  const handleAttendanceAction = async (action: 'entrada' | 'salida') => {
    if (estadoAsistencia?.attendancePhotoRequired ?? systemSettings.attendance_photo_required) {
      setCameraAction({ action, scope: 'academic' });
      return;
    }

    await markAttendance(action);
  };

  const handleAdministrativeAction = async (action: 'entrada' | 'salida') => {
    if (administrativeState?.attendancePhotoRequired ?? systemSettings.attendance_photo_required) {
      setCameraAction({ action, scope: 'administrative' });
      return;
    }
    await markAdministrative(action);
  };

  const moduleTabs = [
    canViewTeacherAttendance && { key: 'teacher_attendance', label: 'Marcar asistencia' },
    canViewTeacherDay && { key: 'teacher_academic_day', label: 'Mi jornada docente' },
    canViewTeacherDay && { key: 'teacher_administrative_day', label: 'Mi jornada administrativa' },
    canViewInstitutionalAnalytics && { key: 'analytics', label: 'Dashboard' },
    canManageUsers && { key: 'users', label: 'Usuarios' },
    canConfigureModules && { key: 'settings', label: 'Configuración' },
    canManageAcademic && { key: 'academic', label: 'Académico' },
    canManageSchedules && { key: 'schedules', label: 'Horarios' },
    canManageAdministrativeHours && { key: 'administrative_hours', label: 'Horas administrativas' },
    canViewReports && { key: 'reports', label: 'Reportes' },
    canViewSystemStatus && { key: 'system_status', label: 'Estado' },
  ].filter(Boolean) as ModuleTab[];

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
      <DashboardHeader user={user} onLogout={() => void handleLogout()} />

      {/* Contenido principal */}
      <main className="mx-auto max-w-7xl px-4 py-6 animate-fade-in sm:px-6 lg:px-8 lg:py-8">
        <DashboardWelcome nombre={user?.nombre} fechaPanel={fechaPanel} hora={hora} />
        <DashboardKpis reportSummary={reportSummary} />

        {moduleTabs.length > 0 && (
          <ModuleTabs moduleTabs={moduleTabs} activeModuleTab={activeModuleTab} setActiveModuleTab={setActiveModuleTab} />
        )}

        {/* Panel de acciones rápidas */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {activeModuleTab === 'teacher_attendance' && canViewTeacherAttendance && (
            <TeacherAttendanceCard
              estadoAsistencia={estadoAsistencia}
              attendanceMessage={attendanceMessage}
              attendanceError={attendanceError}
              attendanceLoading={attendanceLoading}
              onAction={handleAttendanceAction}
            />
          )}

          {activeModuleTab === 'teacher_attendance' && canViewTeacherAttendance && (
            <AdministrativeAttendanceCard
              administrativeState={administrativeState}
              administrativeCanMarkExit={administrativeCanMarkExit}
              administrativeMessage={administrativeMessage}
              administrativeError={administrativeError}
              administrativeLoading={administrativeLoading}
              onAction={handleAdministrativeAction}
            />
          )}

          {activeModuleTab === 'system_status' && canViewSystemStatus && (
            <Suspense fallback={<ModuleLoading />}>
              <SystemStatusCard className="lg:col-span-3" />
            </Suspense>
          )}
        </div>

        <Suspense fallback={<ModuleLoading />}>
          {activeModuleTab === 'teacher_academic_day' && canViewTeacherDay && (
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

          {activeModuleTab === 'teacher_administrative_day' && canViewTeacherDay && (
            <AdministrativeDaySection
              diaSemanaEcuador={diaSemanaEcuador}
              schedules={administrativeSchedulesToday}
              records={administrativeHistory}
              error={administrativeDayError}
            />
          )}

          {activeModuleTab === 'administrative_hours' && canManageAdministrativeHours && (
            <AdministrativeHoursSection docentes={docentes} periodos={periodosAcademicos} />
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
              {...academic}
            />
          )}

          {activeModuleTab === 'schedules' && canManageSchedules && (
            <SchedulesSection
              carreras={carreras}
              materias={materias}
              docentes={docentes}
              periodosAcademicos={periodosAcademicos}
              horarios={horarios}
              {...schedules}
              adminError={schedules.adminError || loadError}
              userRole={user?.rol}
            />
          )}

          {activeModuleTab === 'reports' && canViewReports && (
            <ReportsSection
              reportType={reportType}
              setReportType={setReportType}
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

        </Suspense>

        {cameraAction && (
          <Suspense fallback={null}>
            <CameraCaptureModal
              action={cameraAction.action}
              loading={cameraAction.scope === 'academic' ? attendanceLoading : administrativeLoading}
              onCancel={() => setCameraAction(null)}
              onConfirm={(photoBase64) => void confirmCameraAttendance(photoBase64)}
            />
          </Suspense>
        )}

        <DashboardFooter />
      </main>
    </div>
  );
}
