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
