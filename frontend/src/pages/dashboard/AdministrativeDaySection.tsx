import type { AdministrativeRecordItem, AdministrativeScheduleItem } from './hooks/useAdministrativeDay';

interface AdministrativeDaySectionProps {
  diaSemanaEcuador: string;
  schedules: AdministrativeScheduleItem[];
  records: AdministrativeRecordItem[];
  error: string;
}

function time(value: string | null): string {
  return value ? new Date(value).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '-';
}

export function AdministrativeDaySection({ diaSemanaEcuador, schedules, records, error }: AdministrativeDaySectionProps) {
  return (
    <section className="dashboard-section">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Mi jornada administrativa</h2>
          <p className="section-subtitle">Bloques administrativos del día e historial reciente de marcaciones.</p>
        </div>
        <div className="text-sm text-slate-500 capitalize">{diaSemanaEcuador}</div>
      </div>
      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,2.3fr)]">
        <div>
          <h3 className="text-sm font-semibold uppercase text-slate-500">Bloques de hoy</h3>
          <div className="mt-3 space-y-2">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-md border border-teal-200 bg-teal-50 px-3 py-3">
                <p className="text-sm font-semibold text-slate-700">{schedule.descripcion || 'Actividad administrativa'}</p>
                <p className="mt-1 text-xs text-slate-500">{schedule.hora_inicio} - {schedule.hora_fin} · {schedule.modalidad}{schedule.ubicacion ? ` · ${schedule.ubicacion}` : ''}</p>
              </div>
            ))}
            {schedules.length === 0 && <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">No tiene horas administrativas programadas para hoy.</p>}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase text-slate-500">Marcaciones recientes</h3>
          <div className="table-container mt-3"><table className="min-w-[620px] w-full divide-y divide-slate-200 text-sm"><thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2 pr-4">Actividad</th><th className="py-2 pr-4">Horario</th><th className="py-2 pr-4">Entrada</th><th className="py-2 pr-4">Salida</th><th className="py-2 pr-4">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">
            {records.map((record) => <tr key={record.id}><td className="py-2 pr-4 text-slate-700">{record.horario_administrativo.descripcion || 'Actividad administrativa'}</td><td className="py-2 pr-4 text-slate-500">{record.horario_administrativo.hora_inicio} - {record.horario_administrativo.hora_fin}</td><td className="py-2 pr-4 text-slate-500">{time(record.timestamp_entrada)}</td><td className="py-2 pr-4 text-slate-500">{time(record.timestamp_salida)}</td><td className="py-2 pr-4"><span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-800">{record.timestamp_salida ? record.estado : 'En curso'}</span></td></tr>)}
            {records.length === 0 && <tr><td className="py-4 text-slate-500" colSpan={5}>Sin marcaciones administrativas recientes.</td></tr>}
          </tbody></table></div>
        </div>
      </div>
    </section>
  );
}
