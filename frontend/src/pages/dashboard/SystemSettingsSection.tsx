import type { SystemSettings } from './types';

interface SystemSettingsSectionProps {
  settings: SystemSettings;
  loading: boolean;
  message: string;
  error: string;
  setSettings: (settings: SystemSettings) => void;
  saveSettings: (settings: SystemSettings) => Promise<void>;
}

export function SystemSettingsSection({
  settings,
  loading,
  message,
  error,
  setSettings,
  saveSettings,
}: SystemSettingsSectionProps) {
  return (
    <section className="dashboard-section">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Configuración del sistema</h2>
          <p className="section-subtitle">
            Defina reglas generales para el registro de asistencia.
          </p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-istl-700">TICs</span>
      </div>

      {message && (
        <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
        <label className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="block text-sm font-semibold text-slate-700">Exigir foto en ingreso y salida</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Cuando está activo, el docente debe capturar una imagen antes de confirmar cada marcación.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.attendance_photo_required}
            onChange={(event) =>
              setSettings({ ...settings, attendance_photo_required: event.target.checked })
            }
            className="h-5 w-5 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
          />
        </label>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Ventanas de marcación</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Estas reglas aplican a clases y horas administrativas. Puede regularlas según las disposiciones institucionales.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ['attendance_entry_before_minutes', 'Ingreso antes del inicio', 'Minutos que se habilita antes de la hora programada.'],
            ['attendance_entry_after_minutes', 'Ingreso después del inicio', 'Máximo de minutos para registrar el ingreso.'],
            ['attendance_exit_before_minutes', 'Salida antes del fin', 'Minutos antes de finalizar en que se habilita la salida.'],
            ['attendance_exit_after_minutes', 'Salida después del fin', 'Máximo de minutos para registrar la salida.'],
          ].map(([key, label, description]) => (
            <label key={key} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <span className="block font-medium text-slate-700">{label}</span>
              <span className="mt-1 block text-xs text-slate-500">{description}</span>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={settings[key as keyof Pick<SystemSettings, 'attendance_entry_before_minutes' | 'attendance_entry_after_minutes' | 'attendance_exit_before_minutes' | 'attendance_exit_after_minutes'>]}
                  onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
                  className="input-control w-24"
                />
                <span className="text-xs text-slate-500">minutos</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void saveSettings(settings)}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </section>
  );
}
