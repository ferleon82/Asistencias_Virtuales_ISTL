import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { LocationLink } from './LocationLink';
import type { CarreraOption, DocenteOption, MateriaOption, PeriodoAcademicoOption, ReportSummary } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? '';

function attendancePhotoUrl(url?: string): string {
  if (!url) return '';
  return url.startsWith('/uploads') ? `${API_URL}${url}` : url;
}

interface ReportsSectionProps {
  reportFrom: string;
  setReportFrom: Dispatch<SetStateAction<string>>;
  reportTo: string;
  setReportTo: Dispatch<SetStateAction<string>>;
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
  reportPeriodoAcademicoId: string;
  setReportPeriodoAcademicoId: Dispatch<SetStateAction<string>>;
  carreras: CarreraOption[];
  periodosAcademicos: PeriodoAcademicoOption[];
  reportMaterias: MateriaOption[];
  docentes: DocenteOption[];
  reportCiclos: string[];
  reportSummary: ReportSummary | null;
  reportError: string;
  reportLoading: boolean;
  canManageSchedules: boolean;
  userRole?: string;
  downloadReport: (type: 'pdf' | 'excel') => Promise<void>;
  reviewJustificacion: (id: string, action: 'aprobar' | 'rechazar') => Promise<void>;
}

export function ReportsSection({
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
  carreras,
  periodosAcademicos,
  reportMaterias,
  docentes,
  reportCiclos,
  reportSummary,
  reportError,
  reportLoading,
  canManageSchedules,
  userRole,
  downloadReport,
  reviewJustificacion,
}: ReportsSectionProps) {
  const isTeacherReport = userRole === 'docente';
  const previewPageSize = 10;
  const [previewPage, setPreviewPage] = useState(1);
  const previewRecords = reportSummary?.registros ?? [];
  const totalPreviewRecords = previewRecords.length;
  const totalPreviewPages = Math.max(1, Math.ceil(totalPreviewRecords / previewPageSize));
  const safePreviewPage = Math.min(previewPage, totalPreviewPages);
  const previewStartIndex = (safePreviewPage - 1) * previewPageSize;
  const previewEndIndex = Math.min(previewStartIndex + previewPageSize, totalPreviewRecords);
  const visiblePreviewRecords = previewRecords.slice(previewStartIndex, previewEndIndex);

  useEffect(() => {
    setPreviewPage(1);
  }, [reportSummary]);

  useEffect(() => {
    setPreviewPage((current) => Math.min(current, totalPreviewPages));
  }, [totalPreviewPages]);

  return (
    <section className="dashboard-section min-w-0 overflow-hidden">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="max-w-2xl">
          <h2 className="section-title">Reportes de asistencia</h2>
          <p className="section-subtitle">
            Consulte el resumen del periodo y descargue reportes en PDF o Excel.
          </p>
        </div>
        <div className={`grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${isTeacherReport ? '2xl:grid-cols-6' : '2xl:grid-cols-8'}`}>
          <label className="min-w-0 text-sm text-slate-600">
            Desde
            <input
              type="date"
              value={reportFrom}
              onChange={(event) => setReportFrom(event.target.value)}
              className="input-control"
            />
          </label>
          <label className="min-w-0 text-sm text-slate-600">
            Hasta
            <input
              type="date"
              value={reportTo}
              onChange={(event) => setReportTo(event.target.value)}
              className="input-control"
            />
          </label>
          <label className="min-w-0 text-sm text-slate-600">
            Periodo
            <select
              value={reportPeriodoAcademicoId}
              onChange={(event) => setReportPeriodoAcademicoId(event.target.value)}
              className="input-control"
            >
              <option value="">Todos</option>
              {periodosAcademicos.map((periodo) => (
                <option key={periodo.id} value={periodo.id}>
                  {periodo.nombre}
                </option>
              ))}
            </select>
          </label>
          {!isTeacherReport && (
            <label className="min-w-0 text-sm text-slate-600">
              Carrera
              <select
                value={reportCarreraId}
                onChange={(event) => setReportCarreraId(event.target.value)}
                className="input-control"
              >
                <option value="">Todas</option>
                {carreras.map((carrera) => (
                  <option key={carrera.id} value={carrera.id}>{carrera.codigo}</option>
                ))}
              </select>
            </label>
          )}
          <label className="min-w-0 text-sm text-slate-600">
            Materia
            <select
              value={reportMateriaId}
              onChange={(event) => setReportMateriaId(event.target.value)}
              className="input-control"
            >
              <option value="">Todas</option>
              {reportMaterias.map((materia) => (
                <option key={materia.id} value={materia.id}>{materia.codigo}</option>
              ))}
            </select>
          </label>
          {!isTeacherReport && (
            <label className="min-w-0 text-sm text-slate-600">
              Docente
              <select
                value={reportDocenteId}
                onChange={(event) => setReportDocenteId(event.target.value)}
                className="input-control"
              >
                <option value="">Todos</option>
                {docentes.map((docente) => (
                  <option key={docente.id} value={docente.id}>{docente.apellido} {docente.nombre}</option>
                ))}
              </select>
            </label>
          )}
          <label className="min-w-0 text-sm text-slate-600">
            Estado
            <select
              value={reportEstado}
              onChange={(event) => setReportEstado(event.target.value)}
              className="input-control"
            >
              <option value="">Todos</option>
              {['puntual', 'tardanza', 'ausente', 'justificado'].map((estado) => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-sm text-slate-600">
            Ciclo
            <select
              value={reportCiclo}
              onChange={(event) => setReportCiclo(event.target.value)}
              className="input-control"
            >
              <option value="">Todos</option>
              {reportCiclos.map((ciclo) => (
                <option key={ciclo} value={ciclo}>{ciclo}</option>
              ))}
            </select>
          </label>
          <div className={`grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-3 ${isTeacherReport ? '2xl:col-span-6' : '2xl:col-span-8'} 2xl:flex 2xl:justify-end`}>
            <button
              type="button"
              onClick={() => void downloadReport('pdf')}
              disabled={reportLoading}
              className="btn-primary"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => void downloadReport('excel')}
              disabled={reportLoading}
              className="btn-secondary"
            >
              Excel
            </button>
          </div>
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

      <div className="mt-6">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Vista previa</h3>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              {totalPreviewRecords === 0
                ? '0 registros'
                : `${previewStartIndex + 1}-${previewEndIndex} de ${totalPreviewRecords} registros`}
            </span>
            <button
              type="button"
              onClick={() => setPreviewPage((current) => Math.max(1, current - 1))}
              disabled={safePreviewPage === 1 || totalPreviewRecords === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Página anterior"
            >
              &lt;
            </button>
            <span className="min-w-12 text-center">
              {safePreviewPage}/{totalPreviewPages}
            </span>
            <button
              type="button"
              onClick={() => setPreviewPage((current) => Math.min(totalPreviewPages, current + 1))}
              disabled={safePreviewPage === totalPreviewPages || totalPreviewRecords === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Página siguiente"
            >
              &gt;
            </button>
          </div>
        </div>
        <div className="table-container">
          <table className="min-w-[1020px] divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">Docente</th>
              <th className="py-2 pr-4">Carrera</th>
              <th className="py-2 pr-4">Materia</th>
              <th className="py-2 pr-4">Entrada</th>
              <th className="py-2 pr-4">Salida</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4">Ubicación</th>
              <th className="py-2 pr-4">Foto</th>
              <th className="py-2 pr-4">Justificación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visiblePreviewRecords.map((registro, index) => (
              <tr key={`${registro.email}-${registro.entrada}-${previewStartIndex + index}`}>
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
                  <div className="flex flex-col gap-1 text-xs">
                    {registro.foto_entrada_url ? (
                      <a
                        href={attendancePhotoUrl(registro.foto_entrada_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-navy underline"
                      >
                        Entrada
                      </a>
                    ) : (
                      <span className="text-slate-400">Entrada -</span>
                    )}
                    {registro.foto_salida_url ? (
                      <a
                        href={attendancePhotoUrl(registro.foto_salida_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-navy underline"
                      >
                        Salida
                      </a>
                    ) : (
                      <span className="text-slate-400">Salida -</span>
                    )}
                  </div>
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
            {totalPreviewRecords === 0 && (
              <tr>
                <td className="py-4 text-slate-500" colSpan={9}>No hay registros para los filtros seleccionados.</td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
