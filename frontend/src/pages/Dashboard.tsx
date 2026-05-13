import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';

const rolLabels: Record<string, string> = {
  docente: 'Docente',
  coordinador: 'Coordinador de Carrera',
  tics: 'Responsable TICs',
  rectorado: 'Rectorado',
};

const rolColors: Record<string, string> = {
  docente: 'bg-istl-100 text-brand-navy',
  coordinador: 'bg-slate-100 text-slate-700',
  tics: 'bg-teal-50 text-istl-700',
  rectorado: 'bg-amber-50 text-amber-800',
};

interface EstadoAsistenciaActual {
  horarioActivo: {
    id: string;
    hora_inicio: string;
    hora_fin: string;
    modalidad?: string;
    url_aula_virtual?: string | null;
    materia: {
      nombre: string;
      codigo: string;
    };
  } | null;
  registroAbierto: {
    id: string;
    timestamp_entrada: string | null;
    estado: string;
  } | null;
  puedeMarcarEntrada: boolean;
  puedeMarcarSalida: boolean;
  salidaDisponibleDesde?: string | null;
  salidaBloqueadaMotivo?: string | null;
}

interface LocationPayload {
  lat?: number;
  lng?: number;
  precision_m?: number;
}

interface ReportSummary {
  periodo?: {
    fecha_inicio: string;
    fecha_fin: string;
  };
  totalProgramadas: number;
  totalRegistros: number;
  presentes: number;
  puntual: number;
  tardanza: number;
  ausente: number;
  justificado: number;
  registros?: ReportRow[];
}

interface ReportRow {
  id: string;
  docente: string;
  email: string;
  carrera: string;
  materia: string;
  ciclo: string;
  dia: string;
  horario: string;
  entrada: string;
  salida: string;
  estado: string;
  justificacion: string;
  ip_entrada: string;
  lat?: number | string | null;
  lng?: number | string | null;
  precision_m?: number | null;
}

interface CarreraOption {
  id: string;
  nombre: string;
  codigo: string;
  coordinador_id?: string | null;
  activa?: boolean;
  coordinador?: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  } | null;
  _count?: {
    materias: number;
  };
}

interface MateriaOption {
  id: string;
  nombre: string;
  codigo: string;
  carrera_id: string;
  docente_id?: string | null;
  creditos?: number;
  activa?: boolean;
  carrera?: CarreraOption;
  docente?: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  } | null;
}

interface DocenteOption {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
}

interface HorarioItem {
  id: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  ciclo: string;
  modalidad: string;
  url_aula_virtual?: string | null;
  activo: boolean;
  fecha_inicio_ciclo: string;
  fecha_fin_ciclo: string;
  materia_id: string;
  materia: {
    nombre: string;
    codigo: string;
    carrera: {
      nombre: string;
      codigo: string;
    };
    docente?: {
      nombre: string;
      apellido: string;
    } | null;
  };
}

interface HorarioForm {
  materia_id: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  ciclo: string;
  modalidad: string;
  fecha_inicio_ciclo: string;
  fecha_fin_ciclo: string;
  url_aula_virtual: string;
}

interface UsuarioItem {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  cedula: string;
  rol: string;
  telefono?: string | null;
  activo: boolean;
  ultimo_acceso?: string | null;
}

interface UsuarioForm {
  email: string;
  nombre: string;
  apellido: string;
  cedula: string;
  password: string;
  rol: string;
  telefono: string;
  activo: boolean;
}

interface AsistenciaItem {
  id: string;
  timestamp_entrada: string | null;
  timestamp_salida: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  precision_m?: number | null;
  estado: string;
  justificacion?: string | null;
  horario: {
    dia_semana: string;
    hora_inicio: string;
    hora_fin: string;
    modalidad: string;
    materia: {
      nombre: string;
      codigo: string;
      carrera: {
        codigo: string;
        nombre: string;
      };
    };
  };
}

interface CarreraForm {
  nombre: string;
  codigo: string;
  coordinador_id: string;
  activa: boolean;
}

interface MateriaForm {
  nombre: string;
  codigo: string;
  carrera_id: string;
  docente_id: string;
  creditos: number;
  activa: boolean;
}

// KPI Card Component
function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-brand-navy mt-1">{value}</p>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-md ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function toMapCoordinate(value?: number | string | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMapUrl(lat?: number | string | null, lng?: number | string | null): string | null {
  const parsedLat = toMapCoordinate(lat);
  const parsedLng = toMapCoordinate(lng);
  if (parsedLat === null || parsedLng === null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${parsedLat},${parsedLng}`;
}

function LocationLink({
  lat,
  lng,
  precision,
}: {
  lat?: number | string | null;
  lng?: number | string | null;
  precision?: number | null;
}) {
  const mapUrl = getMapUrl(lat, lng);

  if (!mapUrl) {
    return <span className="text-xs text-slate-400">Sin GPS</span>;
  }

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-brand-navy hover:bg-istl-50"
      title={precision ? `Precision aproximada: ${precision} m` : 'Ver ubicacion en mapa'}
    >
      Mapa{precision ? ` · ${precision} m` : ''}
    </a>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [estadoAsistencia, setEstadoAsistencia] = useState<EstadoAsistenciaActual | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [docenteHorariosHoy, setDocenteHorariosHoy] = useState<HorarioItem[]>([]);
  const [docenteHistorial, setDocenteHistorial] = useState<AsistenciaItem[]>([]);
  const [docentePanelError, setDocentePanelError] = useState('');
  const [justificacionText, setJustificacionText] = useState('');
  const [justificacionRegistroId, setJustificacionRegistroId] = useState<string | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [reportError, setReportError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFrom, setReportFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportCarreraId, setReportCarreraId] = useState('');
  const [reportMateriaId, setReportMateriaId] = useState('');
  const [reportDocenteId, setReportDocenteId] = useState('');
  const [reportEstado, setReportEstado] = useState('');
  const [reportCiclo, setReportCiclo] = useState('');
  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [materias, setMaterias] = useState<MateriaOption[]>([]);
  const [docentes, setDocentes] = useState<DocenteOption[]>([]);
  const [horarios, setHorarios] = useState<HorarioItem[]>([]);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [horarioForm, setHorarioForm] = useState<HorarioForm>(() => ({
    materia_id: '',
    dia_semana: 'lunes',
    hora_inicio: '08:00',
    hora_fin: '10:00',
    ciclo: '2026-I',
    modalidad: 'virtual',
    fecha_inicio_ciclo: new Date().toISOString().slice(0, 10),
    fecha_fin_ciclo: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().slice(0, 10),
    url_aula_virtual: '',
  }));
  const [editingHorarioId, setEditingHorarioId] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [usuarioMessage, setUsuarioMessage] = useState('');
  const [usuarioError, setUsuarioError] = useState('');
  const [usuarioLoading, setUsuarioLoading] = useState(false);
  const [editingUsuarioId, setEditingUsuarioId] = useState<string | null>(null);
  const [usuarioRolFilter, setUsuarioRolFilter] = useState('todos');
  const [usuarioForm, setUsuarioForm] = useState<UsuarioForm>(() => ({
    email: '',
    nombre: '',
    apellido: '',
    cedula: '',
    password: 'Password123',
    rol: 'docente',
    telefono: '',
    activo: true,
  }));
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
    creditos: 3,
    activa: true,
  }));
  const [editingMateriaId, setEditingMateriaId] = useState<string | null>(null);
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
  const diaSemanaEcuador = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    weekday: 'long',
  })
    .format(now)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const loadEstadoAsistencia = useCallback(async () => {
    if (user?.rol !== 'docente') return;

    try {
      const { data } = await api.get('/asistencias/estado-actual');
      setEstadoAsistencia(data.data);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo obtener el estado de asistencia.';
      setAttendanceError(message);
    }
  }, [user?.rol]);

  useEffect(() => {
    void loadEstadoAsistencia();
    if (user?.rol !== 'docente') return undefined;

    const intervalId = window.setInterval(() => {
      void loadEstadoAsistencia();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [loadEstadoAsistencia]);

  const loadDocentePanel = useCallback(async () => {
    if (user?.rol !== 'docente') return;

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
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo cargar el panel docente.';
      setDocentePanelError(message);
    }
  }, [diaSemanaEcuador, user?.rol]);

  useEffect(() => {
    void loadDocentePanel();
    if (user?.rol !== 'docente') return undefined;

    const intervalId = window.setInterval(() => {
      void loadDocentePanel();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [loadDocentePanel]);

  const buildReportParams = useCallback(() => {
    const params = new URLSearchParams();
    if (reportFrom) params.set('fecha_inicio', reportFrom);
    if (reportTo) params.set('fecha_fin', reportTo);
    if (reportCarreraId) params.set('carrera_id', reportCarreraId);
    if (reportMateriaId) params.set('materia_id', reportMateriaId);
    if (reportDocenteId) params.set('docente_id', reportDocenteId);
    if (reportEstado) params.set('estado', reportEstado);
    if (reportCiclo) params.set('ciclo', reportCiclo);
    return params;
  }, [reportCarreraId, reportCiclo, reportDocenteId, reportEstado, reportFrom, reportMateriaId, reportTo]);

  const loadReportSummary = useCallback(async () => {
    setReportError('');

    try {
      const params = buildReportParams();
      const { data } = await api.get(`/reportes/resumen?${params.toString()}`);
      setReportSummary(data.data);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo cargar el resumen de reportes.';
      setReportError(message);
    }
  }, [buildReportParams]);

  useEffect(() => {
    void loadReportSummary();
  }, [loadReportSummary]);

  const canManageSchedules = user?.rol === 'coordinador' || user?.rol === 'tics' || user?.rol === 'rectorado';
  const canManageUsers = user?.rol === 'tics' || user?.rol === 'rectorado';
  const filteredUsuarios =
    usuarioRolFilter === 'todos' ? usuarios : usuarios.filter((item) => item.rol === usuarioRolFilter);
  const reportMaterias = reportCarreraId
    ? materias.filter((materia) => materia.carrera_id === reportCarreraId)
    : materias;
  const reportCiclos = Array.from(new Set(horarios.map((horario) => horario.ciclo))).filter(Boolean);

  useEffect(() => {
    if (reportMateriaId && reportCarreraId && !reportMaterias.some((materia) => materia.id === reportMateriaId)) {
      setReportMateriaId('');
    }
  }, [reportCarreraId, reportMateriaId, reportMaterias]);

  const loadAdminData = useCallback(async () => {
    if (!canManageSchedules) return;

    setAdminError('');

    try {
      const [carrerasResponse, materiasResponse, docentesResponse, horariosResponse] = await Promise.all([
        api.get('/admin/carreras'),
        api.get('/admin/materias'),
        api.get('/admin/docentes'),
        api.get('/horarios?activo=true'),
      ]);

      const materiasData = materiasResponse.data.data as MateriaOption[];
      setCarreras(carrerasResponse.data.data);
      setMaterias(materiasData);
      setDocentes(docentesResponse.data.data);
      setHorarios(horariosResponse.data.data);

      setHorarioForm((current) => ({
        ...current,
        materia_id: current.materia_id || materiasData[0]?.id || '',
      }));
      setMateriaForm((current) => ({
        ...current,
        carrera_id: current.carrera_id || carrerasResponse.data.data[0]?.id || '',
        docente_id: current.docente_id || docentesResponse.data.data[0]?.id || '',
      }));
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo cargar la informacion administrativa.';
      setAdminError(message);
    }
  }, [canManageSchedules]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const loadUsuarios = useCallback(async () => {
    if (!canManageUsers) return;

    setUsuarioError('');

    try {
      const { data } = await api.get('/admin/usuarios');
      setUsuarios(data.data);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo cargar la lista de usuarios.';
      setUsuarioError(message);
    }
  }, [canManageUsers]);

  useEffect(() => {
    void loadUsuarios();
  }, [loadUsuarios]);

  const getLocation = async (): Promise<LocationPayload> => {
    if (!navigator.geolocation) return {};

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            precision_m: Math.round(position.coords.accuracy),
          }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
      );
    });
  };

  const markAttendance = async (type: 'entrada' | 'salida') => {
    setAttendanceLoading(true);
    setAttendanceError('');
    setAttendanceMessage('');

    try {
      const location = await getLocation();
      const { data } = await api.post(`/asistencias/${type}`, location);
      setAttendanceMessage(data.message);
      await loadEstadoAsistencia();
      await loadDocentePanel();
      await loadReportSummary();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo registrar la asistencia.';
      setAttendanceError(message);
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
      const { data } = await api.post(`/asistencias/${justificacionRegistroId}/justificacion`, {
        justificacion: justificacionText,
      });
      setAttendanceMessage(data.message ?? 'Justificacion enviada correctamente.');
      setJustificacionRegistroId(null);
      setJustificacionText('');
      await loadDocentePanel();
      await loadReportSummary();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo enviar la justificacion.';
      setAttendanceError(message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const reviewJustificacion = async (id: string, action: 'aprobar' | 'rechazar') => {
    setReportLoading(true);
    setReportError('');

    try {
      await api.post(`/asistencias/${id}/justificacion/${action}`);
      await loadReportSummary();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo procesar la justificacion.';
      setReportError(message);
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
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo descargar el reporte.';
      setReportError(message);
    } finally {
      setReportLoading(false);
    }
  };

  const createHorario = async () => {
    setAdminLoading(true);
    setAdminError('');
    setAdminMessage('');

    try {
      const payload = {
        ...horarioForm,
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
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      hora_fin: horario.hora_fin,
      ciclo: horario.ciclo,
      modalidad: horario.modalidad,
      fecha_inicio_ciclo: horario.fecha_inicio_ciclo.slice(0, 10),
      fecha_fin_ciclo: horario.fecha_fin_ciclo.slice(0, 10),
      url_aula_virtual: horario.url_aula_virtual ?? '',
    });
  };

  const cancelHorarioEdit = () => {
    setEditingHorarioId(null);
    setHorarioForm((current) => ({
      ...current,
      materia_id: materias[0]?.id || current.materia_id,
      dia_semana: 'lunes',
      hora_inicio: '08:00',
      hora_fin: '10:00',
      ciclo: '2026-I',
      modalidad: 'virtual',
      fecha_inicio_ciclo: new Date().toISOString().slice(0, 10),
      fecha_fin_ciclo: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().slice(0, 10),
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

  const resetUsuarioForm = () => {
    setUsuarioForm({
      email: '',
      nombre: '',
      apellido: '',
      cedula: '',
      password: 'Password123',
      rol: 'docente',
      telefono: '',
      activo: true,
    });
    setEditingUsuarioId(null);
  };

  const saveUsuario = async () => {
    setUsuarioLoading(true);
    setUsuarioError('');
    setUsuarioMessage('');

    try {
      const payload = {
        ...usuarioForm,
        telefono: usuarioForm.telefono || undefined,
        password: editingUsuarioId && !usuarioForm.password ? undefined : usuarioForm.password,
      };
      const { data } = editingUsuarioId
        ? await api.put(`/admin/usuarios/${editingUsuarioId}`, payload)
        : await api.post('/admin/usuarios', payload);
      setUsuarioMessage(data.message ?? (editingUsuarioId ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.'));
      resetUsuarioForm();
      await loadUsuarios();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo guardar el usuario.';
      setUsuarioError(message);
    } finally {
      setUsuarioLoading(false);
    }
  };

  const editUsuario = (usuario: UsuarioItem) => {
    setUsuarioMessage('');
    setUsuarioError('');
    setEditingUsuarioId(usuario.id);
    setUsuarioForm({
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      cedula: usuario.cedula,
      password: '',
      rol: usuario.rol,
      telefono: usuario.telefono ?? '',
      activo: usuario.activo,
    });
  };

  const toggleUsuarioActivo = async (usuario: UsuarioItem) => {
    const action = usuario.activo ? 'desactivar' : 'activar';
    if (!window.confirm(`Confirme que desea ${action} este usuario.`)) return;

    setUsuarioLoading(true);
    setUsuarioError('');
    setUsuarioMessage('');

    try {
      const { data } = await api.put(`/admin/usuarios/${usuario.id}`, { activo: !usuario.activo });
      setUsuarioMessage(data.message ?? (usuario.activo ? 'Usuario desactivado correctamente.' : 'Usuario activado correctamente.'));
      if (editingUsuarioId === usuario.id) resetUsuarioForm();
      await loadUsuarios();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo cambiar el estado del usuario.';
      setUsuarioError(message);
    } finally {
      setUsuarioLoading(false);
    }
  };

  const resetUsuarioPassword = async (usuario: UsuarioItem) => {
    setUsuarioLoading(true);
    setUsuarioError('');
    setUsuarioMessage('');

    try {
      const { data } = await api.put(`/admin/usuarios/${usuario.id}`, { password: 'Password123' });
      setUsuarioMessage(data.message ?? 'Contrasena reiniciada correctamente.');
      await loadUsuarios();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo reiniciar la contrasena.';
      setUsuarioError(message);
    } finally {
      setUsuarioLoading(false);
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
    if (!window.confirm('Confirme que desea eliminar esta carrera. Tambien se desactivaran sus materias y horarios.')) return;

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
      creditos: 3,
      activa: true,
    }));
  };

  const deleteMateria = async (id: string) => {
    if (!window.confirm('Confirme que desea eliminar esta materia. Tambien se desactivaran sus horarios.')) return;

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo + nombre */}
            <div className="flex items-center gap-3">
              <img
                src="/brand/istl-icon.png"
                alt="ISTL"
                className="h-10 w-10 object-contain"
              />
              <div>
                <p className="font-brand text-base font-bold text-brand-navy leading-none">ISTL</p>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {/* Bienvenida + Fecha */}
        <div className="mb-8">
          <h1 className="font-brand text-3xl font-bold text-brand-navy">
            ¡Bienvenido/a, {user?.nombre}! 👋
          </h1>
          <p className="text-slate-500 mt-1 capitalize">{fecha} — {hora} (hora Ecuador)</p>
        </div>

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

        {/* Panel de acciones rápidas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Marcar asistencia */}
          {user?.rol === 'docente' && (
            <div className="lg:col-span-1 bg-brand-navy rounded-lg p-6 text-white shadow-lg">
              <h2 className="font-brand text-xl font-bold mb-1">Marcar Asistencia</h2>
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
                  onClick={() => void markAttendance('entrada')}
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
                  onClick={() => void markAttendance('salida')}
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

          {/* Estado del sistema */}
          <div className={`${user?.rol === 'docente' ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-lg p-6 shadow-sm border border-slate-200`}>
            <h2 className="font-brand text-xl font-bold text-brand-navy mb-4">Estado del sistema</h2>
            <div className="space-y-3">
              {[
                { label: 'API Backend', status: 'Conectado', ok: true },
                { label: 'Base de datos PostgreSQL', status: 'Conectado', ok: true },
                { label: 'Redis (caché)', status: 'Conectado', ok: true },
              ].map(({ label, status, ok }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-istl-700' : 'text-amber-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${ok ? 'bg-brand-teal animate-pulse-slow' : 'bg-amber-400'}`} />
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {user?.rol === 'docente' && (
          <section className="mt-6 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-brand text-xl font-bold text-brand-navy">Mi jornada docente</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Horario del dia, aula virtual e historial reciente de marcaciones.
                </p>
              </div>
              <div className="text-sm text-slate-500 capitalize">{diaSemanaEcuador}</div>
            </div>

            {docentePanelError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {docentePanelError}
              </div>
            )}

            {estadoAsistencia?.horarioActivo?.url_aula_virtual && (
              <div className="mt-4 flex flex-col gap-3 rounded-md border border-teal-200 bg-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">
                    Aula virtual activa: {estadoAsistencia.horarioActivo.materia.nombre}
                  </p>
                  <p className="text-xs text-slate-500">
                    {estadoAsistencia.horarioActivo.hora_inicio} - {estadoAsistencia.horarioActivo.hora_fin}
                  </p>
                </div>
                <a
                  href={estadoAsistencia.horarioActivo.url_aula_virtual}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-brand-navy px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-ink"
                >
                  Abrir aula
                </a>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase text-slate-500">Clases de hoy</h3>
                <div className="mt-3 space-y-2">
                  {docenteHorariosHoy.map((horario) => (
                    <div key={horario.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            {horario.materia.codigo} · {horario.materia.nombre}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {horario.hora_inicio} - {horario.hora_fin} · {horario.modalidad}
                          </p>
                        </div>
                        {horario.url_aula_virtual && (
                          <a
                            href={horario.url_aula_virtual}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 rounded-md border border-brand-navy px-2 py-1 text-xs font-medium text-brand-navy hover:bg-istl-50"
                          >
                            Aula
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {docenteHorariosHoy.length === 0 && (
                    <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                      No tiene clases programadas para hoy.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase text-slate-500">Marcaciones recientes</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-slate-500">
                        <th className="py-2 pr-4">Materia</th>
                        <th className="py-2 pr-4">Entrada</th>
                        <th className="py-2 pr-4">Salida</th>
                        <th className="py-2 pr-4">Estado</th>
                        <th className="py-2 pr-4">Ubicacion</th>
                        <th className="py-2 pr-4">Justificacion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {docenteHistorial.map((registro) => (
                        <tr key={registro.id}>
                          <td className="py-2 pr-4 text-slate-700">{registro.horario.materia.codigo}</td>
                          <td className="py-2 pr-4 text-slate-500">
                            {registro.timestamp_entrada
                              ? new Date(registro.timestamp_entrada).toLocaleTimeString('es-EC', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
                          </td>
                          <td className="py-2 pr-4 text-slate-500">
                            {registro.timestamp_salida
                              ? new Date(registro.timestamp_salida).toLocaleTimeString('es-EC', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Abierta'}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="rounded-full bg-istl-50 px-2 py-0.5 text-xs text-brand-navy">
                              {registro.estado}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <LocationLink lat={registro.lat} lng={registro.lng} precision={registro.precision_m} />
                          </td>
                          <td className="py-2 pr-4">
                            {registro.justificacion ? (
                              <span className="text-xs text-slate-500">
                                {registro.estado === 'justificado' ? 'Aprobada' : 'Enviada'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setJustificacionRegistroId(registro.id);
                                  setJustificacionText('');
                                }}
                                className="rounded-md border border-brand-navy px-2 py-1 text-xs font-medium text-brand-navy hover:bg-istl-50"
                              >
                                Solicitar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {docenteHistorial.length === 0 && (
                        <tr>
                          <td className="py-4 text-slate-500" colSpan={6}>Sin marcaciones recientes.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {justificacionRegistroId && (
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <label className="text-sm text-slate-600">
                      Motivo de justificacion
                      <textarea
                        value={justificacionText}
                        onChange={(event) => setJustificacionText(event.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void sendJustificacion()}
                        disabled={attendanceLoading || justificacionText.trim().length < 10}
                        className="rounded-md bg-brand-navy px-3 py-2 text-sm font-semibold text-white hover:bg-brand-ink disabled:bg-slate-300"
                      >
                        Enviar justificacion
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setJustificacionRegistroId(null);
                          setJustificacionText('');
                        }}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {canManageUsers && (
          <section className="mt-6 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-brand text-xl font-bold text-brand-navy">Gestion de usuarios</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Cree cuentas institucionales para docentes, coordinacion, TICs o rectorado.
                </p>
              </div>
              <div className="text-sm text-slate-500">{usuarios.length} usuarios registrados</div>
            </div>

            {usuarioMessage && (
              <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">
                {usuarioMessage}
              </div>
            )}
            {usuarioError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {usuarioError}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="text-sm text-slate-600 md:col-span-2">
                Email institucional
                <input
                  type="email"
                  value={usuarioForm.email}
                  onChange={(event) => setUsuarioForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="usuario@tecnologicoloja.edu.ec"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Nombre
                <input
                  value={usuarioForm.nombre}
                  onChange={(event) => setUsuarioForm((current) => ({ ...current, nombre: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Apellido
                <input
                  value={usuarioForm.apellido}
                  onChange={(event) => setUsuarioForm((current) => ({ ...current, apellido: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Cedula
                <input
                  value={usuarioForm.cedula}
                  onChange={(event) => setUsuarioForm((current) => ({ ...current, cedula: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Rol
                <select
                  value={usuarioForm.rol}
                  onChange={(event) => setUsuarioForm((current) => ({ ...current, rol: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  {Object.entries(rolLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Telefono
                <input
                  value={usuarioForm.telefono}
                  onChange={(event) => setUsuarioForm((current) => ({ ...current, telefono: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                {editingUsuarioId ? 'Nueva contrasena' : 'Contrasena inicial'}
                <input
                  type="password"
                  value={usuarioForm.password}
                  onChange={(event) => setUsuarioForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={editingUsuarioId ? 'Dejar vacia para conservarla' : undefined}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={usuarioForm.activo}
                  onChange={(event) => setUsuarioForm((current) => ({ ...current, activo: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                />
                Activo
              </label>
              <button
                type="button"
                onClick={() => void saveUsuario()}
                disabled={usuarioLoading}
                className="self-end rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink disabled:bg-slate-300"
              >
                {usuarioLoading ? 'Guardando...' : editingUsuarioId ? 'Actualizar usuario' : 'Crear usuario'}
              </button>
              {editingUsuarioId && (
                <button
                  type="button"
                  onClick={resetUsuarioForm}
                  className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar edicion
                </button>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="text-sm text-slate-600">
                Filtrar por rol
                <select
                  value={usuarioRolFilter}
                  onChange={(event) => setUsuarioRolFilter(event.target.value)}
                  className="mt-1 w-full min-w-52 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="todos">Todos</option>
                  {Object.entries(rolLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-slate-500">{filteredUsuarios.length} visibles</p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">Usuario</th>
                    <th className="py-2 pr-4">Rol</th>
                    <th className="py-2 pr-4">Cedula</th>
                    <th className="py-2 pr-4">Ultimo acceso</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsuarios.slice(0, 12).map((usuario) => (
                    <tr key={usuario.id}>
                      <td className="py-2 pr-4">
                        <p className="font-medium text-slate-700">{usuario.nombre} {usuario.apellido}</p>
                        <p className="text-xs text-slate-500">{usuario.email}</p>
                      </td>
                      <td className="py-2 pr-4 text-slate-500">{rolLabels[usuario.rol] ?? usuario.rol}</td>
                      <td className="py-2 pr-4 text-slate-500">{usuario.cedula}</td>
                      <td className="py-2 pr-4 text-slate-500">
                        {usuario.ultimo_acceso
                          ? new Date(usuario.ultimo_acceso).toLocaleDateString('es-EC')
                          : 'Sin ingreso'}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${usuario.activo ? 'bg-teal-50 text-istl-700' : 'bg-slate-100 text-slate-500'}`}>
                          {usuario.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editUsuario(usuario)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleUsuarioActivo(usuario)}
                            disabled={usuarioLoading}
                            className="rounded-md border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:text-slate-400"
                          >
                            {usuario.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void resetUsuarioPassword(usuario)}
                            disabled={usuarioLoading}
                            className="rounded-md border border-brand-navy px-2 py-1 text-xs font-medium text-brand-navy hover:bg-istl-50 disabled:text-slate-400"
                          >
                            Reiniciar clave
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsuarios.length === 0 && (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={6}>No hay usuarios registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {canManageSchedules && (
          <section className="mt-6 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-brand text-xl font-bold text-brand-navy">Gestion academica</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Administre carreras, materias y responsables academicos.
                </p>
              </div>
              <div className="text-sm text-slate-500">
                {carreras.length} carreras · {materias.length} materias
              </div>
            </div>

            {academicMessage && (
              <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">
                {academicMessage}
              </div>
            )}
            {academicError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {academicError}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-2">
              {canManageUsers && (
                <div className="rounded-md border border-slate-200 p-4">
                  <h3 className="font-brand text-lg font-bold text-brand-navy">Carreras</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-sm text-slate-600">
                      Nombre
                      <input
                        value={carreraForm.nombre}
                        onChange={(event) => setCarreraForm((current) => ({ ...current, nombre: event.target.value }))}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Codigo
                      <input
                        value={carreraForm.codigo}
                        onChange={(event) => setCarreraForm((current) => ({ ...current, codigo: event.target.value }))}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      />
                    </label>
                    <label className="text-sm text-slate-600 sm:col-span-2">
                      Coordinador
                      <select
                        value={carreraForm.coordinador_id}
                        onChange={(event) => setCarreraForm((current) => ({ ...current, coordinador_id: event.target.value }))}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      >
                        <option value="">Sin asignar</option>
                        {docentes
                          .filter((docente) => docente.rol === 'coordinador')
                          .map((docente) => (
                            <option key={docente.id} value={docente.id}>
                              {docente.apellido} {docente.nombre}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={carreraForm.activa}
                        onChange={(event) => setCarreraForm((current) => ({ ...current, activa: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                      />
                      Activa
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveCarrera()}
                      disabled={academicLoading}
                      className="self-end rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink disabled:bg-slate-300"
                    >
                      {academicLoading ? 'Guardando...' : editingCarreraId ? 'Actualizar carrera' : 'Crear carrera'}
                    </button>
                    {editingCarreraId && (
                      <button
                        type="button"
                        onClick={cancelCarreraEdit}
                        className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancelar edicion
                      </button>
                    )}
                  </div>

                  <div className="mt-5 space-y-2">
                    {carreras.slice(0, 6).map((carrera) => (
                      <div key={carrera.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{carrera.codigo} · {carrera.nombre}</p>
                          <p className="text-xs text-slate-500">
                            {carrera.coordinador
                              ? `${carrera.coordinador.nombre} ${carrera.coordinador.apellido}`
                              : 'Sin coordinador'}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                          {carrera._count?.materias ?? 0} materias
                        </span>
                        <button
                          type="button"
                          onClick={() => editCarrera(carrera)}
                          className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                        >
                          Editar
                        </button>
                        {(carrera.activa ?? true) && (
                          <button
                            type="button"
                            onClick={() => void deleteCarrera(carrera.id)}
                            disabled={academicLoading}
                            className="ml-2 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-400"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-md border border-slate-200 p-4">
                <h3 className="font-brand text-lg font-bold text-brand-navy">Materias</h3>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-600">
                    Nombre
                    <input
                      value={materiaForm.nombre}
                      onChange={(event) => setMateriaForm((current) => ({ ...current, nombre: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Codigo
                    <input
                      value={materiaForm.codigo}
                      onChange={(event) => setMateriaForm((current) => ({ ...current, codigo: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Carrera
                    <select
                      value={materiaForm.carrera_id}
                      onChange={(event) => setMateriaForm((current) => ({ ...current, carrera_id: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    >
                      {carreras.map((carrera) => (
                        <option key={carrera.id} value={carrera.id}>
                          {carrera.codigo} - {carrera.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-600">
                    Docente
                    <select
                      value={materiaForm.docente_id}
                      onChange={(event) => setMateriaForm((current) => ({ ...current, docente_id: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    >
                      <option value="">Sin asignar</option>
                      {docentes.map((docente) => (
                        <option key={docente.id} value={docente.id}>
                          {docente.apellido} {docente.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-600">
                    Creditos
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={materiaForm.creditos}
                      onChange={(event) =>
                        setMateriaForm((current) => ({ ...current, creditos: Number(event.target.value) }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={materiaForm.activa}
                      onChange={(event) => setMateriaForm((current) => ({ ...current, activa: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                    />
                    Activa
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveMateria()}
                    disabled={academicLoading || !materiaForm.carrera_id}
                    className="self-end rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink disabled:bg-slate-300"
                  >
                    {academicLoading ? 'Guardando...' : editingMateriaId ? 'Actualizar materia' : 'Crear materia'}
                  </button>
                  {editingMateriaId && (
                    <button
                      type="button"
                      onClick={cancelMateriaEdit}
                      className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar edicion
                    </button>
                  )}
                </div>

                <div className="mt-5 space-y-2">
                  {materias.slice(0, 6).map((materia) => (
                    <div key={materia.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{materia.codigo} · {materia.nombre}</p>
                        <p className="text-xs text-slate-500">
                          {materia.carrera?.codigo ?? 'Sin carrera'} ·{' '}
                          {materia.docente ? `${materia.docente.nombre} ${materia.docente.apellido}` : 'Sin docente'}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${materia.activa ?? true ? 'bg-teal-50 text-istl-700' : 'bg-slate-100 text-slate-500'}`}>
                        {materia.activa ?? true ? 'Activa' : 'Inactiva'}
                      </span>
                      <button
                        type="button"
                        onClick={() => editMateria(materia)}
                        className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                      >
                        Editar
                      </button>
                      {(materia.activa ?? true) && (
                        <button
                          type="button"
                          onClick={() => void deleteMateria(materia.id)}
                          disabled={academicLoading}
                          className="ml-2 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-400"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {canManageSchedules && (
          <section className="mt-6 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-brand text-xl font-bold text-brand-navy">Administracion de horarios</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Cree horarios academicos a partir de las materias registradas.
                </p>
              </div>
              <div className="text-sm text-slate-500">
                {carreras.length} carreras · {materias.length} materias · {docentes.length} docentes
              </div>
            </div>

            {adminMessage && (
              <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">
                {adminMessage}
              </div>
            )}
            {adminError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {adminError}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="text-sm text-slate-600 md:col-span-2">
                Materia
                <select
                  value={horarioForm.materia_id}
                  onChange={(event) => setHorarioForm((current) => ({ ...current, materia_id: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.id}>
                      {materia.codigo} - {materia.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Dia
                <select
                  value={horarioForm.dia_semana}
                  onChange={(event) => setHorarioForm((current) => ({ ...current, dia_semana: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'].map((dia) => (
                    <option key={dia} value={dia}>{dia}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Modalidad
                <select
                  value={horarioForm.modalidad}
                  onChange={(event) => setHorarioForm((current) => ({ ...current, modalidad: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  {['virtual', 'presencial', 'hibrida'].map((modalidad) => (
                    <option key={modalidad} value={modalidad}>{modalidad}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Inicio
                <input
                  type="time"
                  value={horarioForm.hora_inicio}
                  onChange={(event) => setHorarioForm((current) => ({ ...current, hora_inicio: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Fin
                <input
                  type="time"
                  value={horarioForm.hora_fin}
                  onChange={(event) => setHorarioForm((current) => ({ ...current, hora_fin: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Ciclo
                <input
                  value={horarioForm.ciclo}
                  onChange={(event) => setHorarioForm((current) => ({ ...current, ciclo: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Inicio ciclo
                <input
                  type="date"
                  value={horarioForm.fecha_inicio_ciclo}
                  onChange={(event) => setHorarioForm((current) => ({ ...current, fecha_inicio_ciclo: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Fin ciclo
                <input
                  type="date"
                  value={horarioForm.fecha_fin_ciclo}
                  onChange={(event) => setHorarioForm((current) => ({ ...current, fecha_fin_ciclo: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600 md:col-span-2">
                URL aula virtual
                <input
                  value={horarioForm.url_aula_virtual}
                  onChange={(event) => setHorarioForm((current) => ({ ...current, url_aula_virtual: event.target.value }))}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <button
                type="button"
                onClick={() => void createHorario()}
                disabled={adminLoading || !horarioForm.materia_id}
                className="self-end rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink disabled:bg-slate-300"
              >
                {adminLoading ? 'Guardando...' : editingHorarioId ? 'Actualizar horario' : 'Crear horario'}
              </button>
              {editingHorarioId && (
                <button
                  type="button"
                  onClick={cancelHorarioEdit}
                  className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar edicion
                </button>
              )}
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">Materia</th>
                    <th className="py-2 pr-4">Carrera</th>
                    <th className="py-2 pr-4">Dia</th>
                    <th className="py-2 pr-4">Hora</th>
                    <th className="py-2 pr-4">Ciclo</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {horarios.slice(0, 8).map((horario) => (
                    <tr key={horario.id}>
                      <td className="py-2 pr-4 text-slate-700">{horario.materia.nombre}</td>
                      <td className="py-2 pr-4 text-slate-500">{horario.materia.carrera.codigo}</td>
                      <td className="py-2 pr-4 text-slate-500">{horario.dia_semana}</td>
                      <td className="py-2 pr-4 text-slate-500">{horario.hora_inicio} - {horario.hora_fin}</td>
                      <td className="py-2 pr-4 text-slate-500">{horario.ciclo}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${horario.activo ? 'bg-teal-50 text-istl-700' : 'bg-slate-100 text-slate-500'}`}>
                          {horario.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editHorario(horario)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          {horario.activo && (
                            <button
                              type="button"
                              onClick={() => void deactivateHorario(horario.id)}
                              disabled={adminLoading}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-400"
                            >
                              Desactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {horarios.length === 0 && (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={7}>No hay horarios registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-6 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-brand text-xl font-bold text-brand-navy">Reportes de asistencia</h2>
              <p className="mt-1 text-sm text-slate-500">
                Consulte el resumen del periodo y descargue reportes en PDF o Excel.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[150px_150px_170px_190px_190px_150px_120px_auto_auto]">
              <label className="text-sm text-slate-600">
                Desde
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(event) => setReportFrom(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Hasta
                <input
                  type="date"
                  value={reportTo}
                  onChange={(event) => setReportTo(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Carrera
                <select
                  value={reportCarreraId}
                  onChange={(event) => setReportCarreraId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">Todas</option>
                  {carreras.map((carrera) => (
                    <option key={carrera.id} value={carrera.id}>{carrera.codigo}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Materia
                <select
                  value={reportMateriaId}
                  onChange={(event) => setReportMateriaId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">Todas</option>
                  {reportMaterias.map((materia) => (
                    <option key={materia.id} value={materia.id}>{materia.codigo}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Docente
                <select
                  value={reportDocenteId}
                  onChange={(event) => setReportDocenteId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">Todos</option>
                  {docentes.map((docente) => (
                    <option key={docente.id} value={docente.id}>{docente.apellido} {docente.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Estado
                <select
                  value={reportEstado}
                  onChange={(event) => setReportEstado(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">Todos</option>
                  {['puntual', 'tardanza', 'ausente', 'justificado'].map((estado) => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Ciclo
                <select
                  value={reportCiclo}
                  onChange={(event) => setReportCiclo(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">Todos</option>
                  {reportCiclos.map((ciclo) => (
                    <option key={ciclo} value={ciclo}>{ciclo}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void downloadReport('pdf')}
                disabled={reportLoading}
                className="self-end rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink disabled:bg-slate-300"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => void downloadReport('excel')}
                disabled={reportLoading}
                className="self-end rounded-md border border-brand-navy px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-istl-50 disabled:border-slate-300 disabled:text-slate-400"
              >
                Excel
              </button>
            </div>
          </div>

          {reportError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {reportError}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Registros', value: reportSummary?.totalRegistros ?? 0 },
              { label: 'Puntuales', value: reportSummary?.puntual ?? 0 },
              { label: 'Tardanzas', value: reportSummary?.tardanza ?? 0 },
              { label: 'Justificados', value: reportSummary?.justificado ?? 0 },
            ].map((item) => (
              <div key={item.label} className="rounded-md bg-slate-50 border border-slate-100 p-3">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="mt-1 text-xl font-bold text-brand-navy">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase text-slate-500">Vista previa</h3>
              <span className="text-xs text-slate-500">{reportSummary?.registros?.length ?? 0} registros</span>
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Docente</th>
                  <th className="py-2 pr-4">Carrera</th>
                  <th className="py-2 pr-4">Materia</th>
                  <th className="py-2 pr-4">Entrada</th>
                  <th className="py-2 pr-4">Salida</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Ubicacion</th>
                  <th className="py-2 pr-4">Justificacion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(reportSummary?.registros ?? []).slice(0, 12).map((registro, index) => (
                  <tr key={`${registro.email}-${registro.entrada}-${index}`}>
                    <td className="py-2 pr-4 text-slate-700">{registro.docente}</td>
                    <td className="py-2 pr-4 text-slate-500">{registro.carrera}</td>
                    <td className="py-2 pr-4 text-slate-500">{registro.materia}</td>
                    <td className="py-2 pr-4 text-slate-500">{registro.entrada || '-'}</td>
                    <td className="py-2 pr-4 text-slate-500">{registro.salida || '-'}</td>
                    <td className="py-2 pr-4">
                      <span className="rounded-full bg-istl-50 px-2 py-0.5 text-xs text-brand-navy">
                        {registro.estado}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <LocationLink lat={registro.lat} lng={registro.lng} precision={registro.precision_m} />
                    </td>
                    <td className="py-2 pr-4">
                      {registro.justificacion ? (
                        <div className="max-w-xs">
                          <p className="truncate text-xs text-slate-500">{registro.justificacion}</p>
                          {registro.estado !== 'justificado' && canManageSchedules && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void reviewJustificacion(registro.id, 'aprobar')}
                                disabled={reportLoading}
                                className="rounded-md border border-teal-200 px-2 py-1 text-xs font-medium text-istl-700 hover:bg-teal-50"
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={() => void reviewJustificacion(registro.id, 'rechazar')}
                                disabled={reportLoading}
                                className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sin solicitud</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(reportSummary?.registros?.length ?? 0) === 0 && (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={8}>No hay registros para los filtros seleccionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer institucional */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            Instituto Superior Tecnológico Loja — Sistema de Asistencia Virtual Docente v1.0
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Dependencia: Ministerio de Educación, Deporte y Cultura del Ecuador
          </p>
        </div>
      </main>
    </div>
  );
}
