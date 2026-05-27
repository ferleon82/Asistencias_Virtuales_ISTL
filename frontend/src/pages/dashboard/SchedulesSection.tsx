import type { Dispatch, SetStateAction } from 'react';
import type {
  CarreraOption,
  DocenteOption,
  HorarioForm,
  HorarioItem,
  MateriaOption,
  PeriodoAcademicoOption,
} from './types';

interface SchedulesSectionProps {
  carreras: CarreraOption[];
  materias: MateriaOption[];
  docentes: DocenteOption[];
  periodosAcademicos: PeriodoAcademicoOption[];
  horarios: HorarioItem[];
  horarioForm: HorarioForm;
  setHorarioForm: Dispatch<SetStateAction<HorarioForm>>;
  adminMessage: string;
  adminError: string;
  adminLoading: boolean;
  editingHorarioId: string | null;
  createHorario: () => Promise<void>;
  editHorario: (horario: HorarioItem) => void;
  cancelHorarioEdit: () => void;
  deactivateHorario: (id: string) => Promise<void>;
}

export function SchedulesSection({
  carreras,
  materias,
  docentes,
  periodosAcademicos,
  horarios,
  horarioForm,
  setHorarioForm,
  adminMessage,
  adminError,
  adminLoading,
  editingHorarioId,
  createHorario,
  editHorario,
  cancelHorarioEdit,
  deactivateHorario,
}: SchedulesSectionProps) {
  return (
    <section className="dashboard-section">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Administracion de horarios</h2>
          <p className="section-subtitle">
            Cree horarios academicos a partir de las materias registradas.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {periodosAcademicos.length} periodos - {carreras.length} carreras - {materias.length} materias - {docentes.length} docentes
        </div>
      </div>

      {adminMessage && (
        <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">
          {adminMessage}
        </div>
      )}
      {adminError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {adminError}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="text-sm text-slate-600 md:col-span-2">
          Materia
          <select
            value={horarioForm.materia_id}
            onChange={(event) => setHorarioForm((current) => ({ ...current, materia_id: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          >
            {materias.map((materia) => (
              <option key={materia.id} value={materia.id}>
                {materia.codigo} - Ciclo {materia.ciclo} - {materia.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600 md:col-span-2">
          Periodo academico
          <select
            value={horarioForm.periodo_academico_id}
            onChange={(event) => {
              const periodo = periodosAcademicos.find((item) => item.id === event.target.value);
              setHorarioForm((current) => ({
                ...current,
                periodo_academico_id: event.target.value,
                ciclo: periodo?.codigo ?? current.ciclo,
                fecha_inicio_ciclo: periodo?.fecha_inicio.slice(0, 10) ?? current.fecha_inicio_ciclo,
                fecha_fin_ciclo: periodo?.fecha_fin.slice(0, 10) ?? current.fecha_fin_ciclo,
              }));
            }}
            className="input-control"
          >
            <option value="">Sin periodo</option>
            {periodosAcademicos
              .filter((periodo) => periodo.activo)
              .map((periodo) => (
                <option key={periodo.id} value={periodo.id}>
                  {periodo.codigo} - {periodo.nombre}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Dia
          <select
            value={horarioForm.dia_semana}
            onChange={(event) => setHorarioForm((current) => ({ ...current, dia_semana: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          >
            {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'].map((dia) => (
              <option key={dia} value={dia}>{dia}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Modalidad
          <select
            value={horarioForm.modalidad}
            onChange={(event) => setHorarioForm((current) => ({ ...current, modalidad: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          >
            {['virtual', 'presencial', 'hibrida'].map((modalidad) => (
              <option key={modalidad} value={modalidad}>{modalidad}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Inicio
          <input
            type="time"
            value={horarioForm.hora_inicio}
            onChange={(event) => setHorarioForm((current) => ({ ...current, hora_inicio: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="text-sm text-slate-600">
          Fin
          <input
            type="time"
            value={horarioForm.hora_fin}
            onChange={(event) => setHorarioForm((current) => ({ ...current, hora_fin: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="text-sm text-slate-600">
          Ciclo
          <input
            value={horarioForm.ciclo}
            onChange={(event) => setHorarioForm((current) => ({ ...current, ciclo: event.target.value }))}
            readOnly={!!horarioForm.periodo_academico_id}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="text-sm text-slate-600">
          Inicio ciclo
          <input
            type="date"
            value={horarioForm.fecha_inicio_ciclo}
            onChange={(event) => setHorarioForm((current) => ({ ...current, fecha_inicio_ciclo: event.target.value }))}
            readOnly={!!horarioForm.periodo_academico_id}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="text-sm text-slate-600">
          Fin ciclo
          <input
            type="date"
            value={horarioForm.fecha_fin_ciclo}
            onChange={(event) => setHorarioForm((current) => ({ ...current, fecha_fin_ciclo: event.target.value }))}
            readOnly={!!horarioForm.periodo_academico_id}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <label className="text-sm text-slate-600 md:col-span-2">
          URL aula virtual
          <input
            value={horarioForm.url_aula_virtual}
            onChange={(event) => setHorarioForm((current) => ({ ...current, url_aula_virtual: event.target.value }))}
            placeholder="https://..."
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </label>
        <button
          type="button"
          onClick={() => void createHorario()}
          disabled={adminLoading || !horarioForm.materia_id}
          className="btn-primary self-end"
        >
          {adminLoading ? 'Guardando...' : editingHorarioId ? 'Actualizar horario' : 'Crear horario'}
        </button>
        {editingHorarioId && (
          <button
            type="button"
            onClick={cancelHorarioEdit}
            className="btn-secondary self-end"
          >
            Cancelar edicion
          </button>
        )}
      </div>

      <div className="table-container mt-6">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">Materia</th>
              <th className="py-2 pr-4">Carrera</th>
              <th className="py-2 pr-4">Dia</th>
              <th className="py-2 pr-4">Hora</th>
              <th className="py-2 pr-4">Ciclo</th>
              <th className="py-2 pr-4">Periodo</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {horarios.slice(0, 8).map((horario) => (
              <tr key={horario.id}>
                <td className="py-2 pr-4 text-slate-700">{horario.materia.nombre}</td>
                <td className="py-2 pr-4 text-slate-500">{horario.materia.carrera.codigo}</td>
                <td className="py-2 pr-4 text-slate-500">{horario.dia_semana}</td>
                <td className="py-2 pr-4 text-slate-500">{horario.hora_inicio} - {horario.hora_fin}</td>
                <td className="py-2 pr-4 text-slate-500">{horario.ciclo}</td>
                <td className="py-2 pr-4 text-slate-500">{horario.periodo_academico?.nombre ?? '-'}</td>
                <td className="py-2 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${horario.activo ? 'bg-teal-50 text-istl-700' : 'bg-slate-100 text-slate-500'}`}>
                    {horario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => editHorario(horario)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    {horario.activo && (
                      <button
                        type="button"
                        onClick={() => void deactivateHorario(horario.id)}
                        disabled={adminLoading}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-400"
                      >
                        Desactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {horarios.length === 0 && (
              <tr>
                <td className="py-4 text-slate-500" colSpan={8}>No hay horarios registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
