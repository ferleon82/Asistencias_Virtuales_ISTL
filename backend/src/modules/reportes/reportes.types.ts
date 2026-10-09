import type { DaySummary, GroupSummary } from './reportes.sessions';

export interface ReportScope {
  id: string;
  rol: string;
}

export interface ReportRow {
  id: string;
  docente: string;
  email: string;
  carrera: string;
  materia: string;
  ciclo: string;
  periodo_academico: string;
  paralelo: string;
  dia: string;
  horario: string;
  entrada: string;
  salida: string;
  estado: string;
  justificacion: string;
  ip_entrada: string;
  foto_entrada_url: string;
  foto_salida_url: string;
  lat: number | null;
  lng: number | null;
  precision_m: number | null;
  lat_entrada: number | null;
  lng_entrada: number | null;
  precision_entrada_m: number | null;
  lat_salida: number | null;
  lng_salida: number | null;
  precision_salida_m: number | null;
}

export interface ReportSummaryData {
  tipo: 'docente' | 'administrativa';
  periodo: {
    fecha_inicio: string;
    fecha_fin: string;
  };
  totalProgramadas: number;
  totalRegistros: number;
  presentes: number;
  puntual: number;
  tardanza: number;
  justificado: number;
  ausente: number;
  registros: ReportRow[];
  porCarrera: GroupSummary[];
  porPeriodo: DaySummary[];
}
