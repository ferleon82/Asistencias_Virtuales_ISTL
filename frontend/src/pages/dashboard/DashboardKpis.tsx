import { KpiCard } from './KpiCard';
import type { ReportSummary } from './types';

interface DashboardKpisProps {
  reportSummary: ReportSummary | null;
}

/** Tarjetas con la asistencia del día actual (no dependen de los filtros de Reportes). */
export function DashboardKpis({ reportSummary }: DashboardKpisProps) {
  return (
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
        subtitle="Iniciadas hasta ahora"
        color="bg-istl-50 text-brand-navy"
        icon={
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
          </svg>
        }
      />
    </div>
  );
}
