import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
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
  userRole?: string;
}

type ScheduleFilters = {
  materia: string;
  carrera: string;
  docente: string;
  dia: string;
  hora: string;
  jornada: string;
  ciclo: string;
  periodo: string;
  estado: string;
};

const pageSize = 10;
const emptyFilters: ScheduleFilters = {
  materia: '',
  carrera: '',
  docente: '',
  dia: '',
  hora: '',
  jornada: '',
  ciclo: '',
  periodo: '',
  estado: '',
};

const dayOptions = [
  ['lunes', 'lunes'],
  ['martes', 'martes'],
  ['miercoles', 'miércoles'],
  ['jueves', 'jueves'],
  ['viernes', 'viernes'],
  ['sabado', 'sábado'],
];

const journeyOptions = [
  ['matutina', 'Matutina'],
  ['vespertina', 'Vespertina'],
  ['nocturna', 'Nocturna'],
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function containsFilter(value: string, filter: string): boolean {
  return normalizeText(value).includes(normalizeText(filter.trim()));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
}

function docenteName(horario: HorarioItem): string {
  return horario.docente ? `${horario.docente.apellido} ${horario.docente.nombre}` : '';
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
  userRole,
}: SchedulesSectionProps) {
  const isCoordinator = userRole === 'coordinador';
  const [scheduleFilters, setScheduleFilters] = useState<ScheduleFilters>(emptyFilters);
  const [schedulePage, setSchedulePage] = useState(1);

  const filterControlClass = 'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal normal-case text-slate-700 outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal';
  const headerLabelClass = 'block text-[11px] font-semibold uppercase text-slate-500';
  const tableMinWidth = isCoordinator ? 'min-w-[1040px]' : 'min-w-[1180px]';
  const tableColSpan = isCoordinator ? 9 : 10;

  const carreraOptions = useMemo(
    () => uniqueSorted(horarios.map((horario) => horario.materia.carrera.codigo)),
    [horarios]
  );
  const cicloOptions = useMemo(
    () => uniqueSorted(horarios.map((horario) => String(horario.materia.ciclo))).sort((a, b) => Number(a) - Number(b)),
    [horarios]
  );
  const periodoOptions = useMemo(
    () => uniqueSorted(horarios.map((horario) => horario.periodo_academico?.nombre ?? '')),
    [horarios]
  );

  const filteredHorarios = useMemo(
    () =>
      horarios.filter((horario) => {
        const hora = `${horario.hora_inicio} - ${horario.hora_fin}`;
        const estado = horario.activo ? 'activo' : 'inactivo';

        return (
          containsFilter(horario.materia.nombre, scheduleFilters.materia) &&
          (isCoordinator || !scheduleFilters.carrera || horario.materia.carrera.codigo === scheduleFilters.carrera) &&
          containsFilter(docenteName(horario), scheduleFilters.docente) &&
          (!scheduleFilters.dia || horario.dia_semana === scheduleFilters.dia) &&
          containsFilter(hora, scheduleFilters.hora) &&
          (!scheduleFilters.jornada || horario.jornada === scheduleFilters.jornada) &&
          (!scheduleFilters.ciclo || String(horario.materia.ciclo) === scheduleFilters.ciclo) &&
          (!scheduleFilters.periodo || horario.periodo_academico?.nombre === scheduleFilters.periodo) &&
          (!scheduleFilters.estado || estado === scheduleFilters.estado)
        );
      }),
    [horarios, isCoordinator, scheduleFilters]
  );

  const totalPages = Math.max(1, Math.ceil(filteredHorarios.length / pageSize));
  const safePage = Math.min(schedulePage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredHorarios.length);
  const visibleHorarios = filteredHorarios.slice(startIndex, endIndex);

  useEffect(() => {
    setSchedulePage(1);
  }, [scheduleFilters, horarios.length]);

  useEffect(() => {
    setSchedulePage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const updateFilter = (key: keyof ScheduleFilters, value: string) => {
    setScheduleFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="dashboard-section">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Administración de horarios</h2>
          <p className="section-subtitle">
            Cree horarios académicos a partir de las materias registradas.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {periodosAcademicos.length} períodos - {carreras.length} carreras - {materias.length} materias - {docentes.length} docentes
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
          Período académico
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
            <option value="">Sin período</option>
            {periodosAcademicos
              .filter((periodo) => periodo.activo)
              .map((periodo) => (
                <option key={periodo.id} value={periodo.id}>
                  {periodo.nombre}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm text-slate-600 md:col-span-2">
          Docente
          <select
            value={horarioForm.docente_id}
            onChange={(event) => setHorarioForm((current) => ({ ...current, docente_id: event.target.value }))}
            className="input-control"
          >
            <option value="">Seleccione un docente</option>
            {docentes.map((docente) => (
              <option key={docente.id} value={docente.id}>
                {docente.apellido} {docente.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Día
          <select
            value={horarioForm.dia_semana}
            onChange={(event) => setHorarioForm((current) => ({ ...current, dia_semana: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
          >
            {dayOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Jornada
          <select
            value={horarioForm.jornada}
            onChange={(event) => setHorarioForm((current) => ({ ...current, jornada: event.target.value }))}
            className="input-control"
          >
            {journeyOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
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
            {[
              ['virtual', 'virtual'],
              ['presencial', 'presencial'],
              ['hibrida', 'híbrida'],
            ].map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
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
          disabled={adminLoading || !horarioForm.materia_id || !horarioForm.docente_id}
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
            Cancelar edición
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {filteredHorarios.length === 0 ? '0 horarios' : `${startIndex + 1}-${endIndex} de ${filteredHorarios.length} horarios`}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setScheduleFilters(emptyFilters)}
            disabled={!Object.values(scheduleFilters).some(Boolean)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
          >
            Limpiar filtros
          </button>
          <button
            type="button"
            onClick={() => setSchedulePage((current) => Math.max(1, current - 1))}
            disabled={safePage === 1 || filteredHorarios.length === 0}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página anterior"
          >
            &lt;
          </button>
          <span className="min-w-12 text-center text-sm">
            {safePage}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setSchedulePage((current) => Math.min(totalPages, current + 1))}
            disabled={safePage === totalPages || filteredHorarios.length === 0}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página siguiente"
          >
            &gt;
          </button>
        </div>
      </div>

      <div className="table-container mt-3">
        <table className={`${tableMinWidth} table-fixed divide-y divide-slate-200 text-sm`}>
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 align-top">
              <th className="w-[21%] py-2 pr-3">
                <span className={headerLabelClass}>Materia</span>
                <input
                  value={scheduleFilters.materia}
                  onChange={(event) => updateFilter('materia', event.target.value)}
                  className={filterControlClass}
                />
              </th>
              {!isCoordinator && (
                <th className="w-[9%] py-2 pr-3">
                  <span className={headerLabelClass}>Carrera</span>
                  <select
                    value={scheduleFilters.carrera}
                    onChange={(event) => updateFilter('carrera', event.target.value)}
                    className={filterControlClass}
                  >
                    <option value="">Todas</option>
                    {carreraOptions.map((carrera) => (
                      <option key={carrera} value={carrera}>{carrera}</option>
                    ))}
                  </select>
                </th>
              )}
              <th className="w-[20%] py-2 pr-3">
                <span className={headerLabelClass}>Docente</span>
                <input
                  value={scheduleFilters.docente}
                  onChange={(event) => updateFilter('docente', event.target.value)}
                  className={filterControlClass}
                />
              </th>
              <th className="w-[10%] py-2 pr-3">
                <span className={headerLabelClass}>Día</span>
                <select
                  value={scheduleFilters.dia}
                  onChange={(event) => updateFilter('dia', event.target.value)}
                  className={filterControlClass}
                >
                  <option value="">Todos</option>
                  {dayOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </th>
              <th className="w-[11%] py-2 pr-3">
                <span className={headerLabelClass}>Hora</span>
                <input
                  value={scheduleFilters.hora}
                  onChange={(event) => updateFilter('hora', event.target.value)}
                  className={filterControlClass}
                />
              </th>
              <th className="w-[11%] py-2 pr-3">
                <span className={headerLabelClass}>Jornada</span>
                <select
                  value={scheduleFilters.jornada}
                  onChange={(event) => updateFilter('jornada', event.target.value)}
                  className={filterControlClass}
                >
                  <option value="">Todas</option>
                  {journeyOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </th>
              <th className="w-[7%] py-2 pr-3">
                <span className={headerLabelClass}>Ciclo</span>
                <select
                  value={scheduleFilters.ciclo}
                  onChange={(event) => updateFilter('ciclo', event.target.value)}
                  className={filterControlClass}
                >
                  <option value="">Todos</option>
                  {cicloOptions.map((ciclo) => (
                    <option key={ciclo} value={ciclo}>{ciclo}</option>
                  ))}
                </select>
              </th>
              <th className="w-[10%] py-2 pr-3">
                <span className={headerLabelClass}>Periodo</span>
                <select
                  value={scheduleFilters.periodo}
                  onChange={(event) => updateFilter('periodo', event.target.value)}
                  className={filterControlClass}
                >
                  <option value="">Todos</option>
                  {periodoOptions.map((periodo) => (
                    <option key={periodo} value={periodo}>{periodo}</option>
                  ))}
                </select>
              </th>
              <th className="w-[9%] py-2 pr-3">
                <span className={headerLabelClass}>Estado</span>
                <select
                  value={scheduleFilters.estado}
                  onChange={(event) => updateFilter('estado', event.target.value)}
                  className={filterControlClass}
                >
                  <option value="">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </th>
              <th className="w-[10%] py-2 pr-3"><span className={headerLabelClass}>Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleHorarios.map((horario) => (
              <tr key={horario.id}>
                <td className="py-2 pr-4 text-slate-700">{horario.materia.nombre}</td>
                {!isCoordinator && <td className="py-2 pr-4 text-slate-500">{horario.materia.carrera.codigo}</td>}
                <td className="py-2 pr-4 text-slate-500">{docenteName(horario) || '-'}</td>
                <td className="py-2 pr-4 text-slate-500">{horario.dia_semana}</td>
                <td className="py-2 pr-4 text-slate-500">{horario.hora_inicio} - {horario.hora_fin}</td>
                <td className="py-2 pr-4 text-slate-500 capitalize">{horario.jornada}</td>
                <td className="py-2 pr-4 text-slate-500">{horario.materia.ciclo}</td>
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
            {filteredHorarios.length === 0 && (
              <tr>
                <td className="py-4 text-slate-500" colSpan={tableColSpan}>No hay horarios para los filtros seleccionados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
