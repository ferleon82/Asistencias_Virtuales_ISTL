import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { NuevoDiaNoLaborable } from './hooks/useDiasNoLaborables';
import type { DiaNoLaborable } from './types';

interface HolidaysSectionProps {
  dias: DiaNoLaborable[];
  form: NuevoDiaNoLaborable;
  setForm: Dispatch<SetStateAction<NuevoDiaNoLaborable>>;
  message: string;
  error: string;
  loading: boolean;
  create: () => Promise<void>;
  remove: (dia: DiaNoLaborable) => Promise<void>;
}

const weekdayFormat = new Intl.DateTimeFormat('es-EC', { weekday: 'long', timeZone: 'UTC' });

function todayEcuador(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
}

function formatFecha(fecha: string): string {
  return fecha.split('-').reverse().join('/');
}

function weekday(fecha: string): string {
  return weekdayFormat.format(new Date(`${fecha}T00:00:00Z`));
}

/** Calendario de días no laborables: lo administran Talento Humano y TICs. */
export function HolidaysSection({ dias, form, setForm, message, error, loading, create, remove }: HolidaysSectionProps) {
  const [mostrarPasados, setMostrarPasados] = useState(false);
  const hoy = todayEcuador();
  const pasados = dias.filter((dia) => dia.fecha < hoy).length;
  const visibles = useMemo(() => (mostrarPasados ? dias : dias.filter((dia) => dia.fecha >= hoy)), [dias, hoy, mostrarPasados]);
  const fechasInvalidas = !!form.fecha_fin && !!form.fecha_inicio && form.fecha_fin < form.fecha_inicio;

  return (
    <section className="dashboard-section">
      <div>
        <h2 className="section-title">Calendario de feriados</h2>
        <p className="section-subtitle">
          En los días registrados no se marca asistencia de clases ni de horas administrativas, y no cuentan como ausencias en los reportes.
        </p>
      </div>

      {message && <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">{message}</div>}
      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="text-sm text-slate-600">
          Desde
          <input
            type="date"
            value={form.fecha_inicio}
            onChange={(event) => setForm((current) => ({ ...current, fecha_inicio: event.target.value }))}
            className="input-control"
          />
        </label>
        <label className="text-sm text-slate-600">
          Hasta (opcional)
          <input
            type="date"
            value={form.fecha_fin}
            min={form.fecha_inicio || undefined}
            onChange={(event) => setForm((current) => ({ ...current, fecha_fin: event.target.value }))}
            className="input-control"
          />
          <span className="mt-1 block text-xs text-slate-500">Para varios días seguidos, como carnaval.</span>
        </label>
        <label className="text-sm text-slate-600 md:col-span-2">
          Descripción
          <input
            value={form.descripcion}
            onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))}
            placeholder="Día de Difuntos"
            maxLength={150}
            className="input-control"
          />
        </label>
      </div>
      {fechasInvalidas && <p className="mt-2 text-xs text-red-600">La fecha final debe ser igual o posterior a la inicial.</p>}
      <button
        type="button"
        onClick={() => void create()}
        disabled={loading || !form.fecha_inicio || form.descripcion.trim().length < 3 || fechasInvalidas}
        className="btn-primary mt-4"
      >
        {loading ? 'Guardando...' : 'Registrar feriado'}
      </button>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {visibles.length} {visibles.length === 1 ? 'día' : 'días'} {mostrarPasados ? 'registrados' : 'desde hoy'}
        </p>
        {pasados > 0 && (
          <button type="button" onClick={() => setMostrarPasados((current) => !current)} className="btn-secondary">
            {mostrarPasados ? 'Ocultar pasados' : `Mostrar pasados (${pasados})`}
          </button>
        )}
      </div>

      <div className="table-container mt-3">
        <table className="min-w-[560px] table-fixed divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="w-[18%] py-2 pr-3">Fecha</th>
              <th className="w-[16%] py-2 pr-3">Día</th>
              <th className="w-[50%] py-2 pr-3">Descripción</th>
              <th className="w-[16%] py-2 pr-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibles.map((dia) => (
              <tr key={dia.id} className={dia.fecha < hoy ? 'text-slate-400' : 'text-slate-700'}>
                <td className="py-2 pr-4">
                  {formatFecha(dia.fecha)}
                  {dia.fecha === hoy && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Hoy</span>}
                </td>
                <td className="py-2 pr-4 capitalize">{weekday(dia.fecha)}</td>
                <td className="py-2 pr-4">{dia.descripcion}</td>
                <td className="py-2 pr-4">
                  <button
                    type="button"
                    onClick={() => void remove(dia)}
                    disabled={loading}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-400"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td className="py-4 text-slate-500" colSpan={4}>
                  No hay feriados registrados{mostrarPasados ? '' : ' desde hoy'}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
