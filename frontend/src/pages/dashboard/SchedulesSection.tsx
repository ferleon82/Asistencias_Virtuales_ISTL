import { useEffect, useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { compareBloques, DIA_CORTO, formatHoras, groupSchedules, horasEntre, jornadaParaEditar, type ScheduleGroup } from './scheduleGroups';
import type {
  CarreraOption,
  DocenteOption,
  HorarioItem,
  JornadaBloqueForm,
  JornadaForm,
  MateriaOption,
  PeriodoAcademicoOption,
} from './types';

interface SchedulesSectionProps {
  carreras: CarreraOption[];
  materias: MateriaOption[];
  docentes: DocenteOption[];
  periodosAcademicos: PeriodoAcademicoOption[];
  horarios: HorarioItem[];
  jornadaForm: JornadaForm;
  setJornadaForm: Dispatch<SetStateAction<JornadaForm>>;
  editingJornada: { asignacionId: string | null } | null;
  adminMessage: string;
  adminError: string;
  adminLoading: boolean;
  formRef: MutableRefObject<HTMLDivElement | null>;
  addBloque: () => void;
  updateBloque: (key: string, changes: Partial<Omit<JornadaBloqueForm, 'key' | 'id'>>) => void;
  removeBloque: (key: string) => void;
  saveJornada: () => Promise<void>;
  editJornada: (group: ScheduleGroup) => void;
  cancelJornadaEdit: () => void;
  deactivateJornada: (group: ScheduleGroup) => Promise<void>;
  userRole?: string;
}

type ScheduleFilters = {
  materia: string;
  carrera: string;
  docente: string;
  dia: string;
  hora: string;
  jornada: string;
  paralelo: string;
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
  paralelo: '',
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

function formatFecha(value?: string): string {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** Problemas detectables antes de enviar: horas invertidas y bloques que se cruzan el mismo día. */
function validarBloques(bloques: JornadaBloqueForm[]): Record<string, string> {
  const errores: Record<string, string> = {};
  bloques.forEach((bloque) => {
    if (bloque.hora_inicio >= bloque.hora_fin) errores[bloque.key] = 'El fin debe ser posterior al inicio.';
  });
  const ordenados = [...bloques].sort(compareBloques);
  for (let i = 1; i < ordenados.length; i += 1) {
    const anterior = ordenados[i - 1];
    const actual = ordenados[i];
    if (anterior.dia_semana === actual.dia_semana && actual.hora_inicio < anterior.hora_fin) {
      errores[actual.key] = errores[actual.key] ?? `Se cruza con ${anterior.hora_inicio}-${anterior.hora_fin} del mismo día.`;
    }
  }
  return errores;
}

export function SchedulesSection({
  carreras,
  materias,
  docentes,
  periodosAcademicos,
  horarios,
  jornadaForm,
  setJornadaForm,
  editingJornada,
  adminMessage,
  adminError,
  adminLoading,
  formRef,
  addBloque,
  updateBloque,
  removeBloque,
  saveJornada,
  editJornada,
  cancelJornadaEdit,
  deactivateJornada,
  userRole,
}: SchedulesSectionProps) {
  const isCoordinator = userRole === 'coordinador';
  const [scheduleFilters, setScheduleFilters] = useState<ScheduleFilters>(emptyFilters);
  const [schedulePage, setSchedulePage] = useState(1);

  const filterControlClass = 'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal normal-case text-slate-700 outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal';
  const headerLabelClass = 'block text-[11px] font-semibold uppercase text-slate-500';
  const tableMinWidth = isCoordinator ? 'min-w-[1040px]' : 'min-w-[1180px]';
  const tableColSpan = isCoordinator ? 9 : 10;

  const periodoSeleccionado = periodosAcademicos.find((periodo) => periodo.id === jornadaForm.periodo_academico_id);
  const erroresBloques = useMemo(() => validarBloques(jornadaForm.bloques), [jornadaForm.bloques]);
  const hayErroresBloques = Object.keys(erroresBloques).length > 0;
  const horasSemana = jornadaForm.bloques.reduce((total, bloque) => total + horasEntre(bloque.hora_inicio, bloque.hora_fin), 0);
  const totalBloques = jornadaForm.bloques.length;
  const bloquesLabel = `${totalBloques} ${totalBloques === 1 ? 'bloque' : 'bloques'}`;

  const groups = useMemo(() => groupSchedules(horarios), [horarios]);

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

  const filteredGroups = useMemo(
    () =>
      groups.filter(({ principal, horarios: bloques }) => {
        const estado = bloques.every((horario) => horario.activo) ? 'activo' : 'inactivo';

        return (
          containsFilter(principal.materia.nombre, scheduleFilters.materia) &&
          (isCoordinator || !scheduleFilters.carrera || principal.materia.carrera.codigo === scheduleFilters.carrera) &&
          containsFilter(docenteName(principal), scheduleFilters.docente) &&
          (!scheduleFilters.dia || bloques.some((horario) => horario.dia_semana === scheduleFilters.dia)) &&
          (!scheduleFilters.hora || bloques.some((horario) => containsFilter(`${horario.hora_inicio} - ${horario.hora_fin}`, scheduleFilters.hora))) &&
          (!scheduleFilters.jornada || principal.jornada === scheduleFilters.jornada) &&
          (!scheduleFilters.paralelo || (principal.asignacion_docente?.paralelo ?? 'A') === scheduleFilters.paralelo) &&
          (!scheduleFilters.ciclo || String(principal.materia.ciclo) === scheduleFilters.ciclo) &&
          (!scheduleFilters.periodo || principal.periodo_academico?.nombre === scheduleFilters.periodo) &&
          (!scheduleFilters.estado || estado === scheduleFilters.estado)
        );
      }),
    [groups, isCoordinator, scheduleFilters]
  );

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const safePage = Math.min(schedulePage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredGroups.length);
  const visibleGroups = filteredGroups.slice(startIndex, endIndex);
  const bloquesVisibles = filteredGroups.reduce((total, group) => total + group.horarios.length, 0);

  useEffect(() => {
    setSchedulePage(1);
  }, [scheduleFilters, horarios.length]);

  useEffect(() => {
    setSchedulePage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const updateFilter = (key: keyof ScheduleFilters, value: string) => {
    setScheduleFilters((current) => ({ ...current, [key]: value }));
  };

  const updateForm = <K extends keyof JornadaForm>(key: K, value: JornadaForm[K]) => {
    setJornadaForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="dashboard-section">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Administración de horarios</h2>
          <p className="section-subtitle">
            Asigne de una sola vez todos los días y horas en que se dicta cada materia.
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

      <div ref={formRef} className="mt-5 scroll-mt-24">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-brand text-lg font-bold text-brand-navy">Jornada semanal de la materia</h3>
          {editingJornada && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Editando jornada</span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">Complete los datos comunes una vez y agregue cada día en que se dicta la materia.</p>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm text-slate-600 md:col-span-2">
            Materia
            <select value={jornadaForm.materia_id} onChange={(event) => updateForm('materia_id', event.target.value)} className="input-control">
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
              value={jornadaForm.periodo_academico_id}
              onChange={(event) => updateForm('periodo_academico_id', event.target.value)}
              className="input-control"
            >
              {periodosAcademicos
                .filter((periodo) => periodo.activo || periodo.id === jornadaForm.periodo_academico_id)
                .map((periodo) => (
                  <option key={periodo.id} value={periodo.id}>
                    {periodo.nombre}
                  </option>
                ))}
            </select>
            {periodoSeleccionado && (
              <span className="mt-1 block text-xs text-slate-500">
                Vigencia: {formatFecha(periodoSeleccionado.fecha_inicio)} - {formatFecha(periodoSeleccionado.fecha_fin)}
              </span>
            )}
          </label>
          <label className="text-sm text-slate-600 md:col-span-2">
            Docente
            <select value={jornadaForm.docente_id} onChange={(event) => updateForm('docente_id', event.target.value)} className="input-control">
              <option value="">Seleccione un docente</option>
              {docentes.map((docente) => (
                <option key={docente.id} value={docente.id}>
                  {docente.apellido} {docente.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Jornada
            <select value={jornadaForm.jornada} onChange={(event) => updateForm('jornada', event.target.value)} className="input-control">
              {journeyOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Paralelo
            <select value={jornadaForm.paralelo} onChange={(event) => updateForm('paralelo', event.target.value)} className="input-control">
              {['A', 'B', 'C', 'D'].map((paralelo) => (
                <option key={paralelo} value={paralelo}>{paralelo}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Modalidad
            <select value={jornadaForm.modalidad} onChange={(event) => updateForm('modalidad', event.target.value)} className="input-control">
              {[
                ['virtual', 'virtual'],
                ['presencial', 'presencial'],
                ['hibrida', 'híbrida'],
              ].map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600 md:col-span-3">
            URL aula virtual
            <input
              value={jornadaForm.url_aula_virtual}
              onChange={(event) => updateForm('url_aula_virtual', event.target.value)}
              placeholder="https://..."
              className="input-control"
            />
          </label>
        </div>

        <div className="mt-5 rounded-md border border-slate-200 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold text-brand-navy">Bloques semanales</h4>
            <span className="text-sm text-slate-500">
              {bloquesLabel} · {formatHoras(horasSemana)}/semana
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {jornadaForm.bloques.map((bloque) => (
              <div key={bloque.key}>
                <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_4rem_auto] items-center gap-2">
                  <select
                    value={bloque.dia_semana}
                    onChange={(event) => updateBloque(bloque.key, { dia_semana: event.target.value })}
                    className="input-control !mt-0"
                    aria-label="Día"
                  >
                    {dayOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={bloque.hora_inicio}
                    onChange={(event) => updateBloque(bloque.key, { hora_inicio: event.target.value })}
                    className="input-control !mt-0"
                    aria-label="Hora de inicio"
                  />
                  <input
                    type="time"
                    value={bloque.hora_fin}
                    onChange={(event) => updateBloque(bloque.key, { hora_fin: event.target.value })}
                    className="input-control !mt-0"
                    aria-label="Hora de fin"
                  />
                  <span className="text-sm text-slate-500">{formatHoras(horasEntre(bloque.hora_inicio, bloque.hora_fin))}</span>
                  {jornadaForm.bloques.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeBloque(bloque.key)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Quitar
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
                {erroresBloques[bloque.key] && <p className="mt-1 text-xs text-red-600">{erroresBloques[bloque.key]}</p>}
              </div>
            ))}
          </div>
          <button type="button" onClick={addBloque} className="btn-secondary mt-3">
            + Agregar día
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveJornada()}
            disabled={adminLoading || hayErroresBloques || !jornadaForm.materia_id || !jornadaForm.docente_id || !jornadaForm.periodo_academico_id}
            className="btn-primary"
          >
            {adminLoading ? 'Guardando...' : `${editingJornada ? 'Actualizar jornada' : 'Guardar jornada'} (${bloquesLabel})`}
          </button>
          {editingJornada && (
            <button type="button" onClick={cancelJornadaEdit} className="btn-secondary">
              Cancelar edición
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {filteredGroups.length === 0
            ? '0 jornadas'
            : `${startIndex + 1}-${endIndex} de ${filteredGroups.length} jornadas (${bloquesVisibles} bloques)`}
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
            disabled={safePage === 1 || filteredGroups.length === 0}
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
            disabled={safePage === totalPages || filteredGroups.length === 0}
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
              <th className="w-[18%] py-2 pr-3">
                <span className={headerLabelClass}>Materia</span>
                <input value={scheduleFilters.materia} onChange={(event) => updateFilter('materia', event.target.value)} className={filterControlClass} />
              </th>
              {!isCoordinator && (
                <th className="w-[8%] py-2 pr-3">
                  <span className={headerLabelClass}>Carrera</span>
                  <select value={scheduleFilters.carrera} onChange={(event) => updateFilter('carrera', event.target.value)} className={filterControlClass}>
                    <option value="">Todas</option>
                    {carreraOptions.map((carrera) => (
                      <option key={carrera} value={carrera}>{carrera}</option>
                    ))}
                  </select>
                </th>
              )}
              <th className="w-[16%] py-2 pr-3">
                <span className={headerLabelClass}>Docente</span>
                <input value={scheduleFilters.docente} onChange={(event) => updateFilter('docente', event.target.value)} className={filterControlClass} />
              </th>
              <th className="w-[22%] py-2 pr-3">
                <span className={headerLabelClass}>Días y horas</span>
                <div className="grid grid-cols-2 gap-1">
                  <select value={scheduleFilters.dia} onChange={(event) => updateFilter('dia', event.target.value)} className={filterControlClass} aria-label="Filtrar por día">
                    <option value="">Todos</option>
                    {dayOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input
                    value={scheduleFilters.hora}
                    onChange={(event) => updateFilter('hora', event.target.value)}
                    placeholder="08:00"
                    className={filterControlClass}
                    aria-label="Filtrar por hora"
                  />
                </div>
              </th>
              <th className="w-[9%] py-2 pr-3">
                <span className={headerLabelClass}>Jornada</span>
                <select value={scheduleFilters.jornada} onChange={(event) => updateFilter('jornada', event.target.value)} className={filterControlClass}>
                  <option value="">Todas</option>
                  {journeyOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </th>
              <th className="w-[6%] py-2 pr-3">
                <span className={headerLabelClass}>Paralelo</span>
                <input value={scheduleFilters.paralelo} onChange={(event) => updateFilter('paralelo', event.target.value.toUpperCase())} className={filterControlClass} />
              </th>
              <th className="w-[6%] py-2 pr-3">
                <span className={headerLabelClass}>Ciclo</span>
                <select value={scheduleFilters.ciclo} onChange={(event) => updateFilter('ciclo', event.target.value)} className={filterControlClass}>
                  <option value="">Todos</option>
                  {cicloOptions.map((ciclo) => (
                    <option key={ciclo} value={ciclo}>{ciclo}</option>
                  ))}
                </select>
              </th>
              <th className="w-[9%] py-2 pr-3">
                <span className={headerLabelClass}>Periodo</span>
                <select value={scheduleFilters.periodo} onChange={(event) => updateFilter('periodo', event.target.value)} className={filterControlClass}>
                  <option value="">Todos</option>
                  {periodoOptions.map((periodo) => (
                    <option key={periodo} value={periodo}>{periodo}</option>
                  ))}
                </select>
              </th>
              <th className="w-[7%] py-2 pr-3">
                <span className={headerLabelClass}>Estado</span>
                <select value={scheduleFilters.estado} onChange={(event) => updateFilter('estado', event.target.value)} className={filterControlClass}>
                  <option value="">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </th>
              <th className="w-[11%] py-2 pr-3"><span className={headerLabelClass}>Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleGroups.map((group) => {
              const { principal } = group;
              const activo = group.horarios.every((horario) => horario.activo);
              const enEdicion = !!editingJornada && editingJornada.asignacionId === group.asignacionId &&
                (group.asignacionId !== null || jornadaForm.bloques.some((bloque) => bloque.id === principal.id));
              return (
                <tr key={group.key} className={enEdicion ? 'bg-amber-50/50' : undefined}>
                  <td className="py-2 pr-4 text-slate-700">{principal.materia.nombre}</td>
                  {!isCoordinator && <td className="py-2 pr-4 text-slate-500">{principal.materia.carrera.codigo}</td>}
                  <td className="py-2 pr-4 text-slate-500">{docenteName(principal) || '-'}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {group.horarios.map((horario) => (
                        <span key={horario.id} className="rounded-md bg-istl-50 px-2 py-0.5 text-xs text-istl-700">
                          {DIA_CORTO[horario.dia_semana] ?? horario.dia_semana} {horario.hora_inicio}-{horario.hora_fin}
                        </span>
                      ))}
                    </div>
                    <span className="mt-1 block text-xs text-slate-400">{formatHoras(group.horasSemana)}/semana</span>
                  </td>
                  <td className="py-2 pr-4 text-slate-500 capitalize">{principal.jornada}</td>
                  <td className="py-2 pr-4 text-slate-500">{principal.asignacion_docente?.paralelo ?? 'A'}</td>
                  <td className="py-2 pr-4 text-slate-500">{principal.materia.ciclo}</td>
                  <td className="py-2 pr-4 text-slate-500">{principal.periodo_academico?.nombre ?? '-'}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${activo ? 'bg-teal-50 text-istl-700' : 'bg-slate-100 text-slate-500'}`}>
                      {activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => editJornada(jornadaParaEditar(group, groups))}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Editar jornada
                      </button>
                      {activo && (
                        <button
                          type="button"
                          onClick={() => void deactivateJornada(group)}
                          disabled={adminLoading}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-400"
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredGroups.length === 0 && (
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
