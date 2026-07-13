import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { type Dispatch, type SetStateAction, useMemo, useState } from 'react';
import type { CarreraOption, DocenteOption, MateriaOption, PeriodoAcademicoOption, ReportSummary } from './types';

interface AnalyticsDashboardProps {
  reportSummary: ReportSummary | null;
  reportFrom: string;
  setReportFrom: Dispatch<SetStateAction<string>>;
  reportTo: string;
  setReportTo: Dispatch<SetStateAction<string>>;
  reportPeriodoAcademicoId: string;
  setReportPeriodoAcademicoId: Dispatch<SetStateAction<string>>;
  reportCarreraId: string;
  setReportCarreraId: Dispatch<SetStateAction<string>>;
  reportMateriaId: string;
  setReportMateriaId: Dispatch<SetStateAction<string>>;
  reportDocenteId: string;
  setReportDocenteId: Dispatch<SetStateAction<string>>;
  reportEstado: string;
  setReportEstado: Dispatch<SetStateAction<string>>;
  reportCiclo: string;
  setReportCiclo: Dispatch<SetStateAction<string>>;
  periodosAcademicos: PeriodoAcademicoOption[];
  carreras: CarreraOption[];
  reportMaterias: MateriaOption[];
  docentes: DocenteOption[];
  reportCiclos: string[];
  reportLoading: boolean;
  loadReportSummary: () => Promise<void>;
  resetReportFilters: () => void;
  downloadReport: (type: 'pdf' | 'excel') => Promise<void>;
}

const COLORS = {
  puntual: '#0f9b9b',
  tardanza: '#f59e0b',
  ausente: '#ef4444',
  justificado: '#64748b',
  programadas: '#0b3358',
  presentes: '#14b8a6',
  cumplimiento: '#2563eb',
};

const metricOptions = [
  { key: 'presentes', label: 'Presentes', color: COLORS.presentes },
  { key: 'puntual', label: 'Puntuales', color: COLORS.puntual },
  { key: 'tardanza', label: 'Tardanzas', color: COLORS.tardanza },
  { key: 'ausente', label: 'Ausencias', color: COLORS.ausente },
  { key: 'justificado', label: 'Justificadas', color: COLORS.justificado },
] as const;

type MetricKey = (typeof metricOptions)[number]['key'];
type MainView = 'carreras' | 'tendencia';

function percent(value: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

export function AnalyticsDashboard({
  reportSummary,
  reportFrom,
  setReportFrom,
  reportTo,
  setReportTo,
  reportPeriodoAcademicoId,
  setReportPeriodoAcademicoId,
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
  periodosAcademicos,
  carreras,
  reportMaterias,
  docentes,
  reportCiclos,
  reportLoading,
  loadReportSummary,
  resetReportFilters,
  downloadReport,
}: AnalyticsDashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('presentes');
  const [mainView, setMainView] = useState<MainView>('carreras');
  const [careerLimit, setCareerLimit] = useState(8);
  const selectedMetricMeta = metricOptions.find((item) => item.key === selectedMetric) ?? metricOptions[0];
  const rawCareerData = useMemo(
    () =>
      (reportSummary?.porCarrera ?? []).map((item) => ({
        ...item,
        carreraLabel: item.codigo || item.carrera,
        cumplimiento: item.programadas ? Math.round((item.presentes / item.programadas) * 100) : 0,
      })),
    [reportSummary]
  );
  const careerData = useMemo(
    () =>
      [...rawCareerData]
        .sort((a, b) => Number(b[selectedMetric]) - Number(a[selectedMetric]))
        .slice(0, careerLimit),
    [careerLimit, rawCareerData, selectedMetric]
  );
  const periodData = useMemo(
    () =>
      (reportSummary?.porPeriodo ?? []).map((item) => ({
        ...item,
        cumplimiento: item.programadas ? Math.round((item.presentes / item.programadas) * 100) : 0,
      })),
    [reportSummary]
  );
  const stateData = useMemo(
    () =>
      [
        { name: 'Puntuales', value: reportSummary?.puntual ?? 0, color: COLORS.puntual },
        { name: 'Tardanzas', value: reportSummary?.tardanza ?? 0, color: COLORS.tardanza },
        { name: 'Ausentes', value: reportSummary?.ausente ?? 0, color: COLORS.ausente },
        { name: 'Justificadas', value: reportSummary?.justificado ?? 0, color: COLORS.justificado },
      ].filter((item) => item.value > 0),
    [reportSummary]
  );
  const stateBars = useMemo(
    () =>
      [
        { label: 'Puntuales', value: reportSummary?.puntual ?? 0, color: 'bg-teal-500' },
        { label: 'Tardanzas', value: reportSummary?.tardanza ?? 0, color: 'bg-amber-500' },
        { label: 'Ausencias', value: reportSummary?.ausente ?? 0, color: 'bg-red-500' },
        { label: 'Justificadas', value: reportSummary?.justificado ?? 0, color: 'bg-slate-500' },
      ],
    [reportSummary]
  );
  const totalProgramadas = reportSummary?.totalProgramadas ?? 0;
  const totalRegistros = reportSummary?.totalRegistros ?? 0;
  const presentes = reportSummary?.presentes ?? 0;
  const tardanzas = reportSummary?.tardanza ?? 0;
  const ausentes = reportSummary?.ausente ?? 0;
  const cumplimiento = percent(presentes, totalProgramadas);
  const puntualidad = percent(reportSummary?.puntual ?? 0, totalRegistros);
  const topCareer = [...rawCareerData].sort((a, b) => b.presentes - a.presentes)[0];
  const weakestCareer = [...rawCareerData].sort((a, b) => a.cumplimiento - b.cumplimiento)[0];
  const activeFilterCount = [
    reportPeriodoAcademicoId,
    reportCarreraId,
    reportMateriaId,
    reportDocenteId,
    reportEstado,
    reportCiclo,
  ].filter(Boolean).length;

  return (
    <section className="dashboard-section min-w-0 overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Dashboard institucional</h2>
          <p className="section-subtitle">
            Indicadores estadísticos para seguimiento de Rectorado y Talento Humano.
          </p>
        </div>
        <span className="status-pill bg-istl-50 text-istl-700">Rectorado / Talento Humano</span>
      </div>

      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-brand text-lg font-bold text-brand-navy">Filtros de análisis</h3>
            <p className="text-sm text-slate-500">Seleccione los campos que desea cruzar para recalcular el dashboard.</p>
          </div>
          <span className="status-pill bg-white text-slate-600">{activeFilterCount} filtros activos</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="field-label">
            Desde
            <input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} className="input-control" />
          </label>
          <label className="field-label">
            Hasta
            <input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} className="input-control" />
          </label>
          <label className="field-label">
            Periodo
            <select value={reportPeriodoAcademicoId} onChange={(event) => setReportPeriodoAcademicoId(event.target.value)} className="input-control">
              <option value="">Todos</option>
              {periodosAcademicos.map((periodo) => (
                <option key={periodo.id} value={periodo.id}>{periodo.codigo}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Carrera
            <select value={reportCarreraId} onChange={(event) => setReportCarreraId(event.target.value)} className="input-control">
              <option value="">Todas</option>
              {carreras.map((carrera) => (
                <option key={carrera.id} value={carrera.id}>{carrera.codigo}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Materia
            <select value={reportMateriaId} onChange={(event) => setReportMateriaId(event.target.value)} className="input-control">
              <option value="">Todas</option>
              {reportMaterias.map((materia) => (
                <option key={materia.id} value={materia.id}>{materia.codigo}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Docente
            <select value={reportDocenteId} onChange={(event) => setReportDocenteId(event.target.value)} className="input-control">
              <option value="">Todos</option>
              {docentes.map((docente) => (
                <option key={docente.id} value={docente.id}>{docente.apellido} {docente.nombre}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Estado
            <select value={reportEstado} onChange={(event) => setReportEstado(event.target.value)} className="input-control">
              <option value="">Todos</option>
              {['puntual', 'tardanza', 'ausente', 'justificado'].map((estado) => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Ciclo
            <select value={reportCiclo} onChange={(event) => setReportCiclo(event.target.value)} className="input-control">
              <option value="">Todos</option>
              {reportCiclos.map((ciclo) => (
                <option key={ciclo} value={ciclo}>{ciclo}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
          <button type="button" onClick={resetReportFilters} className="btn-secondary">
            Limpiar filtros
          </button>
          <button type="button" onClick={() => void loadReportSummary()} disabled={reportLoading} className="btn-primary">
            {reportLoading ? 'Consultando...' : 'Consultar'}
          </button>
          <button type="button" onClick={() => void downloadReport('pdf')} disabled={reportLoading} className="btn-secondary">
            PDF
          </button>
          <button type="button" onClick={() => void downloadReport('excel')} disabled={reportLoading} className="btn-secondary">
            Excel
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          { label: 'Cumplimiento', value: cumplimiento, detail: `${presentes}/${totalProgramadas} clases con ingreso` },
          { label: 'Puntualidad', value: puntualidad, detail: 'Sobre registros del filtro' },
          { label: 'Tardanzas', value: tardanzas, detail: 'Marcaciones fuera de hora' },
          { label: 'Ausencias', value: ausentes, detail: 'Programadas sin ingreso' },
        ].map((item) => (
          <div key={item.label} className="rounded-md border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-brand-navy">{item.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Métrica principal</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {metricOptions.map((metric) => (
              <button
                key={metric.key}
                type="button"
                onClick={() => setSelectedMetric(metric.key)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                  selectedMetric === metric.key
                    ? 'border-brand-navy bg-brand-navy text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {metric.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-slate-50 p-1">
          {[
            { key: 'carreras', label: 'Carreras' },
            { key: 'tendencia', label: 'Tendencia' },
          ].map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => setMainView(view.key as MainView)}
              className={`rounded px-3 py-2 text-sm font-semibold transition-colors ${
                mainView === view.key ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-brand-navy'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-md border border-slate-200 p-4 xl:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-brand text-lg font-bold text-brand-navy">
                {mainView === 'carreras' ? 'Asistencia por carrera' : 'Tendencia diaria'}
              </h3>
              <p className="text-sm text-slate-500">
                {mainView === 'carreras'
                  ? `Ordenado por ${selectedMetricMeta.label.toLowerCase()}.`
                  : `Evolución de ${selectedMetricMeta.label.toLowerCase()} dentro del rango.`}
              </p>
            </div>
            {mainView === 'carreras' && (
              <select
                value={careerLimit}
                onChange={(event) => setCareerLimit(Number(event.target.value))}
                className="input-control max-w-36"
              >
                <option value={5}>Top 5</option>
                <option value={8}>Top 8</option>
                <option value={12}>Top 12</option>
              </select>
            )}
          </div>
          <div className="h-80 min-w-0">
            {(mainView === 'carreras' ? careerData : periodData).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {mainView === 'carreras' ? (
                  <BarChart data={careerData} margin={{ top: 8, right: 12, left: -18, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="carreraLabel" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="programadas" name="Programadas" fill={COLORS.programadas} radius={[4, 4, 0, 0]} />
                    <Bar dataKey={selectedMetric} name={selectedMetricMeta.label} fill={selectedMetricMeta.color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <ComposedChart data={periodData} margin={{ top: 8, right: 12, left: -18, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="periodo" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey={selectedMetric} name={selectedMetricMeta.label} fill={selectedMetricMeta.color} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumplimiento" name="Cumplimiento %" stroke={COLORS.cumplimiento} strokeWidth={3} dot={{ r: 3 }} />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-md bg-slate-50 text-sm text-slate-500">
                Sin datos para graficar.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 p-4">
          <div className="mb-4">
            <h3 className="font-brand text-lg font-bold text-brand-navy">Distribución de estados</h3>
            <p className="text-sm text-slate-500">Participación general del periodo filtrado.</p>
          </div>
          <div className="h-80 min-w-0">
            {stateData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stateData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={3}>
                    {stateData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-md bg-slate-50 text-sm text-slate-500">
                Sin datos para graficar.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.4fr]">
        <div className="rounded-md border border-slate-200 p-4">
          <h3 className="font-brand text-lg font-bold text-brand-navy">Lectura rápida</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Mayor actividad</p>
              <p className="mt-1 text-sm font-semibold text-brand-navy">
                {topCareer ? `${topCareer.carrera} (${topCareer.presentes} presentes)` : 'Sin datos'}
              </p>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Requiere seguimiento</p>
              <p className="mt-1 text-sm font-semibold text-brand-navy">
                {weakestCareer ? `${weakestCareer.carrera} (${weakestCareer.cumplimiento}% cumplimiento)` : 'Sin datos'}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {stateBars.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{item.label}</span>
                  <span>{percent(item.value, totalRegistros)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${item.color}`}
                    style={{ width: percent(item.value, totalRegistros) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 p-4">
          <div className="mb-4">
            <h3 className="font-brand text-lg font-bold text-brand-navy">Cumplimiento por periodo</h3>
            <p className="text-sm text-slate-500">Línea porcentual frente a clases programadas.</p>
          </div>
          <div className="h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={periodData} margin={{ top: 8, right: 12, left: -18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="periodo" tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="programadas" name="Programadas" fill={COLORS.programadas} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="cumplimiento" name="Cumplimiento %" stroke={COLORS.cumplimiento} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
