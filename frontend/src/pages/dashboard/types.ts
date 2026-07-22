export interface EstadoAsistenciaActual {
  horarioActivo: {
    id: string;
    hora_inicio: string;
    hora_fin: string;
    modalidad?: string;
    jornada?: string;
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
  attendancePhotoRequired?: boolean;
  salidaDisponibleDesde?: string | null;
  salidaBloqueadaMotivo?: string | null;
}

export interface LocationPayload {
  lat?: number;
  lng?: number;
  precision_m?: number;
  foto_base64?: string;
}

export interface ReportSummary {
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
  porCarrera?: ReportCareerSummary[];
  porPeriodo?: ReportPeriodSummary[];
}

export interface ReportCareerSummary {
  carrera: string;
  codigo: string;
  programadas: number;
  registros: number;
  presentes: number;
  puntual: number;
  tardanza: number;
  ausente: number;
  justificado: number;
}

export interface ReportPeriodSummary {
  periodo: string;
  programadas: number;
  registros: number;
  presentes: number;
  puntual: number;
  tardanza: number;
  ausente: number;
  justificado: number;
}

export interface ReportRow {
  id: string;
  docente: string;
  email: string;
  carrera: string;
  materia: string;
  ciclo: string;
  periodo_academico?: string;
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
  foto_entrada_url?: string | null;
  foto_salida_url?: string | null;
}

export interface CarreraOption {
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

export interface MateriaOption {
  id: string;
  nombre: string;
  codigo: string;
  carrera_id: string;
  docente_id?: string | null;
  ciclo: number;
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

export interface DocenteOption {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
}

export interface PeriodoAcademicoOption {
  id: string;
  nombre: string;
  codigo: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

export interface HorarioItem {
  id: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  ciclo: string;
  periodo_academico_id?: string | null;
  periodo_academico?: PeriodoAcademicoOption | null;
  docente_id?: string | null;
  docente?: {
    id: string;
    nombre: string;
    apellido: string;
    email?: string;
  } | null;
  jornada: string;
  modalidad: string;
  url_aula_virtual?: string | null;
  activo: boolean;
  fecha_inicio_ciclo: string;
  fecha_fin_ciclo: string;
  materia_id: string;
  materia: {
    nombre: string;
    codigo: string;
    ciclo: number;
    carrera: {
      nombre: string;
      codigo: string;
    };
    docente?: {
      id?: string;
      nombre: string;
      apellido: string;
    } | null;
  };
}

export interface HorarioForm {
  materia_id: string;
  docente_id: string;
  periodo_academico_id: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  ciclo: string;
  jornada: string;
  modalidad: string;
  fecha_inicio_ciclo: string;
  fecha_fin_ciclo: string;
  url_aula_virtual: string;
}
export interface UsuarioItem {
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

export interface UsuarioForm {
  email: string;
  nombre: string;
  apellido: string;
  cedula: string;
  password: string;
  rol: string;
  telefono: string;
  activo: boolean;
}

export interface AsistenciaItem {
  id: string;
  timestamp_entrada: string | null;
  timestamp_salida: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  precision_m?: number | null;
  foto_entrada_url?: string | null;
  foto_salida_url?: string | null;
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

export interface CarreraForm {
  nombre: string;
  codigo: string;
  coordinador_id: string;
  activa: boolean;
}

export interface MateriaForm {
  nombre: string;
  codigo: string;
  carrera_id: string;
  docente_id: string;
  ciclo: number;
  creditos: number;
  activa: boolean;
}

export interface PeriodoAcademicoForm {
  nombre: string;
  codigo: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

export interface ModulePermission {
  id: string;
  module_key: string;
  module_label: string;
  rol: string;
  enabled: boolean;
}

export interface SystemSettings {
  attendance_photo_required: boolean;
}
