import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type {
  CarreraForm,
  CarreraOption,
  DocenteOption,
  MateriaForm,
  MateriaOption,
  PeriodoAcademicoForm,
  PeriodoAcademicoOption,
} from './types';

interface AcademicSectionProps {
  canManageUsers: boolean;
  carreras: CarreraOption[];
  materias: MateriaOption[];
  docentes: DocenteOption[];
  periodosAcademicos: PeriodoAcademicoOption[];
  carreraForm: CarreraForm;
  setCarreraForm: Dispatch<SetStateAction<CarreraForm>>;
  periodoForm: PeriodoAcademicoForm;
  setPeriodoForm: Dispatch<SetStateAction<PeriodoAcademicoForm>>;
  materiaForm: MateriaForm;
  setMateriaForm: Dispatch<SetStateAction<MateriaForm>>;
  academicMessage: string;
  academicError: string;
  academicLoading: boolean;
  editingCarreraId: string | null;
  editingPeriodoId: string | null;
  editingMateriaId: string | null;
  saveCarrera: () => Promise<void>;
  editCarrera: (carrera: CarreraOption) => void;
  cancelCarreraEdit: () => void;
  deleteCarrera: (id: string) => Promise<void>;
  savePeriodoAcademico: () => Promise<void>;
  editPeriodoAcademico: (periodo: PeriodoAcademicoOption) => void;
  cancelPeriodoEdit: () => void;
  deletePeriodoAcademico: (id: string) => Promise<void>;
  saveMateria: () => Promise<void>;
  editMateria: (materia: MateriaOption) => void;
  cancelMateriaEdit: () => void;
  deleteMateria: (id: string) => Promise<void>;
}

export function AcademicSection({
  canManageUsers,
  carreras,
  materias,
  docentes,
  periodosAcademicos,
  carreraForm,
  setCarreraForm,
  periodoForm,
  setPeriodoForm,
  materiaForm,
  setMateriaForm,
  academicMessage,
  academicError,
  academicLoading,
  editingCarreraId,
  editingPeriodoId,
  editingMateriaId,
  saveCarrera,
  editCarrera,
  cancelCarreraEdit,
  deleteCarrera,
  savePeriodoAcademico,
  editPeriodoAcademico,
  cancelPeriodoEdit,
  deletePeriodoAcademico,
  saveMateria,
  editMateria,
  cancelMateriaEdit,
  deleteMateria,
}: AcademicSectionProps) {
  const filteredMaterias = useMemo(() => {
    if (!materiaForm.carrera_id || !materiaForm.ciclo) return [];

    return materias.filter(
      (materia) => materia.carrera_id === materiaForm.carrera_id && materia.ciclo === materiaForm.ciclo
    );
  }, [materiaForm.carrera_id, materiaForm.ciclo, materias]);
  const materiasEnFormulario = useMemo(
    () =>
      materias.filter(
        (materia) => materia.activa && materia.carrera_id === materiaForm.carrera_id && materia.ciclo === materiaForm.ciclo
      ).length,
    [materiaForm.carrera_id, materiaForm.ciclo, materias]
  );

  return (
    <section className="dashboard-section">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="section-title">Gestion academica</h2>
          <p className="section-subtitle">
            Administre carreras, materias y responsables academicos.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {periodosAcademicos.length} periodos - {carreras.length} carreras - {materias.length} materias
        </div>
      </div>

      {academicMessage && (
        <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">
          {academicMessage}
        </div>
      )}
      {academicError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {academicError}
        </div>
      )}

      <div className="mt-5 space-y-6">
        {canManageUsers && (
          <div className="rounded-md border border-slate-200 p-4">
            <h3 className="font-brand text-lg font-bold text-brand-navy">Periodos academicos</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="text-sm text-slate-600">
                Nombre
                <input
                  value={periodoForm.nombre}
                  onChange={(event) => setPeriodoForm((current) => ({ ...current, nombre: event.target.value }))}
                  className="input-control"
                />
              </label>
              <label className="text-sm text-slate-600">
                Codigo
                <input
                  value={periodoForm.codigo}
                  onChange={(event) => setPeriodoForm((current) => ({ ...current, codigo: event.target.value }))}
                  className="input-control uppercase"
                />
              </label>
              <label className="text-sm text-slate-600">
                Inicio
                <input
                  type="date"
                  value={periodoForm.fecha_inicio}
                  onChange={(event) => setPeriodoForm((current) => ({ ...current, fecha_inicio: event.target.value }))}
                  className="input-control"
                />
              </label>
              <label className="text-sm text-slate-600">
                Fin
                <input
                  type="date"
                  value={periodoForm.fecha_fin}
                  onChange={(event) => setPeriodoForm((current) => ({ ...current, fecha_fin: event.target.value }))}
                  className="input-control"
                />
              </label>
              <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={periodoForm.activo}
                  onChange={(event) => setPeriodoForm((current) => ({ ...current, activo: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                />
                Activo
              </label>
              <button
                type="button"
                onClick={() => void savePeriodoAcademico()}
                disabled={academicLoading}
                className="btn-primary self-end"
              >
                {academicLoading ? 'Guardando...' : editingPeriodoId ? 'Actualizar periodo' : 'Crear periodo'}
              </button>
              {editingPeriodoId && (
                <button type="button" onClick={cancelPeriodoEdit} className="btn-secondary self-end">
                  Cancelar edicion
                </button>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 xl:grid-cols-2">
              {periodosAcademicos.map((periodo) => (
                <div key={periodo.id} className="grid gap-3 rounded-md bg-slate-50 px-3 py-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">{periodo.codigo} - {periodo.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {periodo.fecha_inicio.slice(0, 10)} a {periodo.fecha_fin.slice(0, 10)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${periodo.activo ? 'bg-teal-50 text-istl-700' : 'bg-slate-100 text-slate-500'}`}>
                    {periodo.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => editPeriodoAcademico(periodo)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                  >
                    Editar
                  </button>
                  {periodo.activo && (
                    <button
                      type="button"
                      onClick={() => void deletePeriodoAcademico(periodo.id)}
                      disabled={academicLoading}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-400"
                    >
                      Desactivar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {canManageUsers && (
          <div className="rounded-md border border-slate-200 p-4">
            <h3 className="font-brand text-lg font-bold text-brand-navy">Carreras</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm text-slate-600">
                Nombre
                <input
                  value={carreraForm.nombre}
                  onChange={(event) => setCarreraForm((current) => ({ ...current, nombre: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600">
                Codigo
                <input
                  value={carreraForm.codigo}
                  onChange={(event) => setCarreraForm((current) => ({ ...current, codigo: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </label>
              <label className="text-sm text-slate-600 md:col-span-2">
                Coordinador
                <select
                  value={carreraForm.coordinador_id}
                  onChange={(event) => setCarreraForm((current) => ({ ...current, coordinador_id: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">Sin asignar</option>
                  {docentes
                    .filter((docente) => docente.rol === 'coordinador')
                    .map((docente) => (
                      <option key={docente.id} value={docente.id}>
                        {docente.apellido} {docente.nombre}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={carreraForm.activa}
                  onChange={(event) => setCarreraForm((current) => ({ ...current, activa: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                />
                Activa
              </label>
              <button
                type="button"
                onClick={() => void saveCarrera()}
                disabled={academicLoading}
                className="btn-primary self-end"
              >
                {academicLoading ? 'Guardando...' : editingCarreraId ? 'Actualizar carrera' : 'Crear carrera'}
              </button>
              {editingCarreraId && (
                <button
                  type="button"
                  onClick={cancelCarreraEdit}
                  className="btn-secondary self-end"
                >
                  Cancelar edicion
                </button>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 xl:grid-cols-2">
              {carreras.map((carrera) => (
                <div key={carrera.id} className="grid gap-3 rounded-md bg-slate-50 px-3 py-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">{carrera.codigo} - {carrera.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {carrera.coordinador
                        ? `${carrera.coordinador.nombre} ${carrera.coordinador.apellido}`
                        : 'Sin coordinador'}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                    {carrera._count?.materias ?? 0} materias
                  </span>
                  <button
                    type="button"
                    onClick={() => editCarrera(carrera)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                  >
                    Editar
                  </button>
                  {(carrera.activa ?? true) && (
                    <button
                      type="button"
                      onClick={() => void deleteCarrera(carrera.id)}
                      disabled={academicLoading}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-400"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-md border border-slate-200 p-4">
          <div>
            <h3 className="font-brand text-lg font-bold text-brand-navy">Materias</h3>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm text-slate-600">
              Nombre
              <input
                value={materiaForm.nombre}
                onChange={(event) => setMateriaForm((current) => ({ ...current, nombre: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
              />
            </label>
            <label className="text-sm text-slate-600">
              Codigo
              <input
                value={materiaForm.codigo}
                onChange={(event) => setMateriaForm((current) => ({ ...current, codigo: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
              />
            </label>
            <label className="text-sm text-slate-600">
              Carrera
              <select
                value={materiaForm.carrera_id}
                onChange={(event) => setMateriaForm((current) => ({ ...current, carrera_id: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
              >
                {carreras.map((carrera) => (
                  <option key={carrera.id} value={carrera.id}>
                    {carrera.codigo} - {carrera.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Docente
              <select
                value={materiaForm.docente_id}
                onChange={(event) => setMateriaForm((current) => ({ ...current, docente_id: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
              >
                <option value="">Sin asignar</option>
                {docentes.map((docente) => (
                  <option key={docente.id} value={docente.id}>
                    {docente.apellido} {docente.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Ciclo
              <select
                value={materiaForm.ciclo}
                onChange={(event) =>
                  setMateriaForm((current) => ({ ...current, ciclo: Number(event.target.value) }))
                }
                className="input-control"
              >
                {[1, 2, 3, 4].map((ciclo) => (
                  <option key={ciclo} value={ciclo}>
                    Ciclo {ciclo}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Creditos
              <input
                type="number"
                min={1}
                max={12}
                value={materiaForm.creditos}
                onChange={(event) =>
                  setMateriaForm((current) => ({ ...current, creditos: Number(event.target.value) }))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
              />
            </label>
            <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={materiaForm.activa}
                onChange={(event) => setMateriaForm((current) => ({ ...current, activa: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
              />
              Activa
            </label>
            <button
              type="button"
              onClick={() => void saveMateria()}
              disabled={academicLoading || !materiaForm.carrera_id || (!editingMateriaId && materiasEnFormulario >= 5)}
              className="btn-primary self-end"
            >
              {academicLoading ? 'Guardando...' : editingMateriaId ? 'Actualizar materia' : 'Crear materia'}
            </button>
            {editingMateriaId && (
              <button
                type="button"
                onClick={cancelMateriaEdit}
                className="btn-secondary self-end"
              >
                Cancelar edicion
              </button>
            )}
          </div>
          {materiasEnFormulario >= 5 && !editingMateriaId && (
            <p className="mt-2 text-xs text-amber-700">
              Esta carrera ya tiene 5 materias activas en el ciclo {materiaForm.ciclo}.
            </p>
          )}

          <div className="mt-5 grid grid-cols-1 gap-2 xl:grid-cols-2">
            {filteredMaterias.map((materia) => (
              <div key={materia.id} className="grid gap-3 rounded-md bg-slate-50 px-3 py-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{materia.codigo} - {materia.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {materia.carrera?.codigo ?? 'Sin carrera'} - Ciclo {materia.ciclo} -{' '}
                    {materia.docente ? `${materia.docente.nombre} ${materia.docente.apellido}` : 'Sin docente'}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${materia.activa ?? true ? 'bg-teal-50 text-istl-700' : 'bg-slate-100 text-slate-500'}`}>
                  {materia.activa ?? true ? 'Activa' : 'Inactiva'}
                </span>
                <button
                  type="button"
                  onClick={() => editMateria(materia)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                >
                  Editar
                </button>
                {(materia.activa ?? true) && (
                  <button
                    type="button"
                    onClick={() => void deleteMateria(materia.id)}
                    disabled={academicLoading}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-400"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            ))}
            {!materiaForm.carrera_id || !materiaForm.ciclo ? (
              <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 xl:col-span-2">
                Seleccione una carrera y un ciclo en el formulario para listar materias.
              </div>
            ) : filteredMaterias.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 xl:col-span-2">
                No hay materias registradas para la carrera y ciclo seleccionados.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
