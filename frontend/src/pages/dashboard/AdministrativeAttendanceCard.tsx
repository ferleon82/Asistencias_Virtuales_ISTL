import type { AdministrativeAttendanceState } from './hooks/useAdministrativeAttendance';

type Action = 'entrada' | 'salida';

interface AdministrativeAttendanceCardProps {
  administrativeState: AdministrativeAttendanceState | null;
  administrativeCanMarkExit: boolean;
  administrativeMessage: string;
  administrativeError: string;
  administrativeLoading: boolean;
  onAction: (action: Action) => Promise<void>;
}

/** Tarjeta para marcar ingreso y salida del bloque administrativo activo. */
export function AdministrativeAttendanceCard({
  administrativeState,
  administrativeCanMarkExit,
  administrativeMessage,
  administrativeError,
  administrativeLoading,
  onAction: handleAdministrativeAction,
}: AdministrativeAttendanceCardProps) {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-6 shadow-sm lg:col-span-3 xl:col-span-1">
      <h2 className="font-brand text-xl font-bold text-brand-navy">Hora administrativa</h2>
      <p className="mt-1 text-sm text-slate-600">Registre el ingreso o salida del bloque administrativo activo.</p>
      <div className="mt-5 rounded-md border border-teal-200 bg-white p-3">
        <p className="text-xs font-medium uppercase text-teal-700">Bloque activo</p>
        {administrativeState?.horarioActivo ? (
          <div className="mt-1 text-sm text-slate-700">
            <p className="font-semibold">{administrativeState.horarioActivo.descripcion || 'Actividad administrativa'}</p>
            <p className="text-xs text-slate-500">{administrativeState.horarioActivo.hora_inicio} - {administrativeState.horarioActivo.hora_fin}{administrativeState.horarioActivo.ubicacion ? ` · ${administrativeState.horarioActivo.ubicacion}` : ''}</p>
          </div>
        ) : <p className="mt-1 text-sm text-slate-500">Sin bloque administrativo dentro de la ventana de marcado.</p>}
        {administrativeState?.registroAbierto && <p className="mt-2 text-xs text-teal-700">Ingreso abierto desde {new Date(administrativeState.registroAbierto.timestamp_entrada ?? '').toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</p>}
        {!administrativeCanMarkExit && administrativeState?.salidaDisponibleDesde && <p className="mt-1 text-xs text-slate-500">Salida disponible desde {new Date(administrativeState.salidaDisponibleDesde).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</p>}
      </div>
      {administrativeMessage && <div className="mt-3 rounded-md border border-teal-200 bg-white p-3 text-sm text-teal-700">{administrativeMessage}</div>}
      {administrativeError && <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{administrativeError}</div>}
      <div className="mt-4 space-y-3">
        <button type="button" onClick={() => void handleAdministrativeAction('entrada')} disabled={administrativeLoading || !administrativeState?.puedeMarcarEntrada} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">{administrativeLoading ? 'Registrando...' : 'Marcar ingreso administrativo'}</button>
        <button type="button" onClick={() => void handleAdministrativeAction('salida')} disabled={administrativeLoading || !administrativeCanMarkExit} title={administrativeState?.salidaBloqueadaMotivo ?? undefined} className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-50">{administrativeLoading ? 'Registrando...' : 'Marcar salida administrativa'}</button>
      </div>
    </div>
  );
}
