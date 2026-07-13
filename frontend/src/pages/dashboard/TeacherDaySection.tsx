import type { Dispatch, SetStateAction } from 'react';
import { LocationLink } from './LocationLink';
import type { AsistenciaItem, EstadoAsistenciaActual, HorarioItem } from './types';

interface TeacherDaySectionProps {
  estadoAsistencia: EstadoAsistenciaActual | null;
  diaSemanaEcuador: string;
  docentePanelError: string;
  docenteHorariosHoy: HorarioItem[];
  docenteHistorial: AsistenciaItem[];
  justificacionRegistroId: string | null;
  setJustificacionRegistroId: Dispatch<SetStateAction<string | null>>;
  justificacionText: string;
  setJustificacionText: Dispatch<SetStateAction<string>>;
  attendanceLoading: boolean;
  sendJustificacion: () => Promise<void>;
}

export function TeacherDaySection({
  estadoAsistencia,
  diaSemanaEcuador,
  docentePanelError,
  docenteHorariosHoy,
  docenteHistorial,
  justificacionRegistroId,
  setJustificacionRegistroId,
  justificacionText,
  setJustificacionText,
  attendanceLoading,
  sendJustificacion,
}: TeacherDaySectionProps) {
  const activeJustificationRecordId =
    estadoAsistencia?.registroAbierto && estadoAsistencia.horarioActivo
      ? estadoAsistencia.registroAbierto.id
      : null;
  const activeHorarioForJustification =
    estadoAsistencia?.puedeMarcarEntrada && estadoAsistencia.horarioActivo
      ? estadoAsistencia.horarioActivo
      : null;

  return (
    <section className="dashboard-section">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Mi jornada docente</h2>
          <p className="section-subtitle">
            Horario del día, aula virtual e historial reciente de marcaciones.
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
            className="btn-primary text-center"
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
                      {horario.materia.codigo} - {horario.materia.nombre}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {horario.hora_inicio} - {horario.hora_fin} - {horario.modalidad}
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
          <div className="table-container mt-3">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Materia</th>
                  <th className="py-2 pr-4">Entrada</th>
                  <th className="py-2 pr-4">Salida</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Ubicación</th>
                  <th className="py-2 pr-4">Justificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeHorarioForJustification && (
                  <tr key={`horario-activo-${activeHorarioForJustification.id}`}>
                    <td className="py-2 pr-4 text-slate-700">{activeHorarioForJustification.materia.codigo}</td>
                    <td className="py-2 pr-4 text-slate-500">Pendiente</td>
                    <td className="py-2 pr-4 text-slate-500">-</td>
                    <td className="py-2 pr-4">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        por marcar
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-400">Sin GPS</td>
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => {
                          setJustificacionRegistroId(`horario:${activeHorarioForJustification.id}`);
                          setJustificacionText('');
                        }}
                        className="rounded-md border border-brand-navy px-2 py-1 text-xs font-medium text-brand-navy hover:bg-istl-50"
                      >
                        Solicitar
                      </button>
                    </td>
                  </tr>
                )}
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
                        : registro.timestamp_entrada
                          ? 'Abierta'
                          : '-'}
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
                      ) : activeJustificationRecordId === registro.id && !registro.timestamp_salida ? (
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
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                        >
                          Solicitar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {docenteHistorial.length === 0 && !activeHorarioForJustification && (
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
                Motivo de justificación
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
                  className="btn-primary"
                >
                  Enviar justificación
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJustificacionRegistroId(null);
                    setJustificacionText('');
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
