import type { EstadoAsistenciaActual } from './types';

type Action = 'entrada' | 'salida';

interface TeacherAttendanceCardProps {
  estadoAsistencia: EstadoAsistenciaActual | null;
  attendanceMessage: string;
  attendanceError: string;
  attendanceLoading: boolean;
  onAction: (action: Action) => Promise<void>;
}

/** Tarjeta para marcar ingreso y salida de la clase activa. */
export function TeacherAttendanceCard({
  estadoAsistencia,
  attendanceMessage,
  attendanceError,
  attendanceLoading,
  onAction: handleAttendanceAction,
}: TeacherAttendanceCardProps) {
  return (
    <div className="rounded-lg bg-brand-navy p-6 text-white shadow-lg lg:col-span-3 xl:col-span-1">
      <h2 className="font-brand text-xl font-bold mb-1">Marcar asistencia</h2>
      <p className="text-slate-200 text-sm mb-5">
        Registre su ingreso o salida de la clase virtual activa.
      </p>
      <div className="mb-4 rounded-md bg-white/10 border border-white/20 p-3">
        <p className="text-xs font-medium text-istl-100">Clase activa</p>
        {estadoAsistencia?.horarioActivo ? (
          <div className="mt-1">
            <p className="text-sm font-semibold">{estadoAsistencia.horarioActivo.materia.nombre}</p>
            <p className="text-xs text-slate-200">
              {estadoAsistencia.horarioActivo.hora_inicio} - {estadoAsistencia.horarioActivo.hora_fin}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-200">Sin clase dentro de la ventana de marcado.</p>
        )}
        {estadoAsistencia?.registroAbierto && (
          <div className="mt-2 space-y-1 text-xs text-teal-100">
            <p>
              Ingreso abierto: {new Date(estadoAsistencia.registroAbierto.timestamp_entrada ?? '').toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {!estadoAsistencia.puedeMarcarSalida && estadoAsistencia.salidaDisponibleDesde && (
              <p>
                Salida disponible desde: {new Date(estadoAsistencia.salidaDisponibleDesde).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}
      </div>
      {attendanceMessage && (
        <div className="mb-3 rounded-md bg-teal-400/20 border border-teal-300/30 p-3 text-sm text-teal-50">
          {attendanceMessage}
        </div>
      )}
      {attendanceError && (
        <div className="mb-3 rounded-md bg-red-400/20 border border-red-300/30 p-3 text-sm text-red-50">
          {attendanceError}
        </div>
      )}
      <div className="space-y-3">
        <button
          id="btn-marcar-entrada"
          onClick={() => void handleAttendanceAction('entrada')}
          disabled={attendanceLoading || !estadoAsistencia?.puedeMarcarEntrada}
          className="w-full py-3 px-4 rounded-md bg-white text-brand-navy font-semibold text-sm hover:bg-istl-50 disabled:bg-white/40 disabled:cursor-not-allowed transition-colors shadow flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd"/>
          </svg>
          {attendanceLoading ? 'Registrando...' : 'Marcar Ingreso'}
        </button>
        <button
          id="btn-marcar-salida"
          onClick={() => void handleAttendanceAction('salida')}
          disabled={attendanceLoading || !estadoAsistencia?.puedeMarcarSalida}
          title={estadoAsistencia?.salidaBloqueadaMotivo ?? undefined}
          className="w-full py-3 px-4 rounded-md bg-white/20 text-white font-semibold text-sm hover:bg-white/30 disabled:bg-white/10 disabled:text-white/50 disabled:cursor-not-allowed transition-colors border border-white/30 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
          </svg>
          {attendanceLoading ? 'Registrando...' : 'Marcar Salida'}
        </button>
      </div>
    </div>
  );
}
