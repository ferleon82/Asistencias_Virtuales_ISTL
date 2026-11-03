import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import api from '../../lib/axios';
import { getApiMessage } from '../../lib/apiError';
import {
  DIAS,
  agruparJornadas,
  diasTexto,
  filasDeBloques,
  formatFecha,
  nuevaFila,
  type AdministrativeBlock,
  type AdministrativeJornada,
  type HorarioFila,
} from './administrativeJornadas';
import type { DocenteOption, PeriodoAcademicoOption } from './types';

interface AdministrativeRecord {
  id: string; timestamp_entrada?: string | null; timestamp_salida?: string | null; estado: string;
  horario_administrativo: { hora_inicio: string; hora_fin: string; descripcion?: string | null; docente: { nombre: string; apellido: string } };
}
interface Props { docentes: DocenteOption[]; periodos: PeriodoAcademicoOption[]; }

interface JornadaForm {
  docente_id: string;
  periodo_academico_id: string;
  vigencia: 'periodo' | 'rango';
  fecha_inicio: string;
  fecha_fin: string;
  modalidad: string;
  ubicacion: string;
  descripcion: string;
  filas: HorarioFila[];
}

const initialForm = (): JornadaForm => ({
  docente_id: '',
  periodo_academico_id: '',
  vigencia: 'periodo',
  fecha_inicio: '',
  fecha_fin: '',
  modalidad: 'presencial',
  ubicacion: '',
  descripcion: '',
  filas: [nuevaFila(['lunes', 'martes', 'miercoles', 'jueves', 'viernes'])],
});

const modalidadLabel: Record<string, string> = { presencial: 'Presencial', virtual: 'Virtual', hibrida: 'Híbrida' };

/** Jornadas administrativas semanales por docente; las administran Talento Humano y TICs. */
export function AdministrativeHoursSection({ docentes, periodos }: Props) {
  const [bloques, setBloques] = useState<AdministrativeBlock[]>([]);
  const [records, setRecords] = useState<AdministrativeRecord[]>([]);
  const [form, setForm] = useState<JornadaForm>(initialForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement | null>(null);

  const periodosActivos = periodos.filter((item) => item.activo);
  const periodo = periodos.find((item) => item.id === form.periodo_academico_id);
  const jornadas = useMemo(() => agruparJornadas(bloques), [bloques]);
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return jornadas;
    return jornadas.filter((jornada) => `${jornada.principal.docente.apellido} ${jornada.principal.docente.nombre}`.toLowerCase().includes(texto));
  }, [busqueda, jornadas]);
  const totalBloques = form.filas.reduce((total, fila) => total + fila.dias.length, 0);

  const load = async () => {
    try {
      const [schedulesResponse, recordsResponse] = await Promise.all([
        api.get('/horas-administrativas?activo=true'),
        api.get('/horas-administrativas/registros'),
      ]);
      setBloques(schedulesResponse.data.data);
      setRecords(recordsResponse.data.data);
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudieron cargar las horas administrativas.'));
    }
  };
  useEffect(() => { void load(); }, []);

  const update = <K extends keyof JornadaForm>(key: K, value: JornadaForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateFila = (key: string, changes: Partial<HorarioFila>) =>
    setForm((current) => ({ ...current, filas: current.filas.map((fila) => (fila.key === key ? { ...fila, ...changes } : fila)) }));
  const toggleDia = (fila: HorarioFila, dia: string) =>
    updateFila(fila.key, { dias: fila.dias.includes(dia) ? fila.dias.filter((item) => item !== dia) : [...fila.dias, dia] });

  const cancelEdit = () => {
    setEditing(null);
    setForm((current) => ({ ...initialForm(), periodo_academico_id: current.periodo_academico_id }));
  };

  const validar = (): string => {
    if (!form.docente_id || !form.periodo_academico_id) return 'Seleccione el docente y el período.';
    if (form.filas.length === 0) return 'Agregue al menos un horario.';
    if (form.filas.some((fila) => fila.dias.length === 0)) return 'Cada horario necesita al menos un día marcado.';
    if (form.filas.some((fila) => fila.hora_inicio >= fila.hora_fin)) return 'En cada horario, la hora de inicio debe ser anterior a la de fin.';
    if (form.vigencia === 'rango') {
      if (!form.fecha_inicio || !form.fecha_fin) return 'Indique las fechas de la jornada temporal.';
      if (form.fecha_fin < form.fecha_inicio) return 'La fecha final debe ser igual o posterior a la inicial.';
    }
    return '';
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const invalido = validar();
    if (invalido) {
      setError(invalido);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        docente_id: form.docente_id,
        periodo_academico_id: form.periodo_academico_id,
        modalidad: form.modalidad,
        ubicacion: form.ubicacion.trim() || undefined,
        descripcion: form.descripcion.trim() || undefined,
        ...(form.vigencia === 'rango' ? { fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin } : {}),
        bloques: form.filas.flatMap((fila) => fila.dias.map((dia_semana) => ({ dia_semana, hora_inicio: fila.hora_inicio, hora_fin: fila.hora_fin }))),
      };
      const { data } = editing
        ? await api.put(`/horas-administrativas/jornadas/${editing}`, payload)
        : await api.post('/horas-administrativas/jornadas', payload);
      setMessage(data.message ?? 'Jornada administrativa guardada.');
      cancelEdit();
      await load();
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo guardar la jornada administrativa.'));
    } finally {
      setLoading(false);
    }
  };

  const edit = (jornada: AdministrativeJornada) => {
    const { principal } = jornada;
    setMessage('');
    setError('');
    setEditing(jornada.grupoId);
    setForm({
      docente_id: principal.docente_id,
      periodo_academico_id: principal.periodo_academico_id,
      vigencia: jornada.temporal ? 'rango' : 'periodo',
      fecha_inicio: jornada.temporal ? principal.fecha_inicio.slice(0, 10) : '',
      fecha_fin: jornada.temporal ? principal.fecha_fin.slice(0, 10) : '',
      modalidad: principal.modalidad,
      ubicacion: principal.ubicacion ?? '',
      descripcion: principal.descripcion ?? '',
      filas: filasDeBloques(jornada.bloques),
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const deactivate = async (jornada: AdministrativeJornada) => {
    const total = jornada.bloques.length;
    if (!window.confirm(`¿Desea desactivar esta jornada (${total} ${total === 1 ? 'bloque' : 'bloques'})? Sus marcaciones se conservan.`)) return;
    setError('');
    setMessage('');
    try {
      const { data } = await api.delete(`/horas-administrativas/jornadas/${jornada.grupoId}`);
      setMessage(data.message ?? 'Jornada administrativa desactivada.');
      if (editing === jornada.grupoId) cancelEdit();
      await load();
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo desactivar la jornada.'));
    }
  };

  const resumen =
    form.vigencia === 'rango' && form.fecha_inicio && form.fecha_fin
      ? `del ${formatFecha(form.fecha_inicio)} al ${formatFecha(form.fecha_fin)}. En esas fechas reemplaza su jornada regular, que vuelve sola al terminar.`
      : 'durante todo el período.';

  return <section className="dashboard-section">
    <div><h2 className="section-title">Horas administrativas</h2><p className="section-subtitle">Configure la jornada semanal no académica de cada docente. La administran Talento Humano y TICs.</p></div>
    {message && <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">{message}</div>}
    {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

    <form ref={formRef} onSubmit={(event) => void submit(event)} className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-700">{editing ? 'Editar jornada administrativa' : 'Nueva jornada administrativa'}</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-600">Docente<select required value={form.docente_id} onChange={(event) => update('docente_id', event.target.value)} className="input-control"><option value="">Seleccione</option>{docentes.map((item) => <option key={item.id} value={item.id}>{item.apellido} {item.nombre}</option>)}</select></label>
        <label className="text-sm text-slate-600">Período<select required value={form.periodo_academico_id} onChange={(event) => update('periodo_academico_id', event.target.value)} className="input-control"><option value="">Seleccione</option>{periodosActivos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
      </div>

      <div className="mt-4">
        <span className="text-sm text-slate-600">Vigencia</span>
        <div className="mt-1 inline-flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
          {([['periodo', 'Todo el período'], ['rango', 'Rango de fechas']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => update('vigencia', value)} className={`px-3 py-1.5 ${form.vigencia === value ? 'bg-istl-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
          ))}
        </div>
        {form.vigencia === 'rango' && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-600">Desde<input type="date" value={form.fecha_inicio} min={periodo?.fecha_inicio.slice(0, 10)} max={periodo?.fecha_fin.slice(0, 10)} onChange={(event) => update('fecha_inicio', event.target.value)} className="input-control" /></label>
            <label className="text-sm text-slate-600">Hasta<input type="date" value={form.fecha_fin} min={form.fecha_inicio || periodo?.fecha_inicio.slice(0, 10)} max={periodo?.fecha_fin.slice(0, 10)} onChange={(event) => update('fecha_fin', event.target.value)} className="input-control" /></label>
            <p className="text-xs text-amber-700 md:col-span-2">Jornada temporal: en estas fechas reemplaza la jornada regular del docente (por ejemplo, dos semanas solo virtual).</p>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-sm text-slate-600">Modalidad<select value={form.modalidad} onChange={(event) => update('modalidad', event.target.value)} className="input-control"><option value="presencial">Presencial</option><option value="virtual">Virtual</option><option value="hibrida">Híbrida</option></select></label>
        <label className="text-sm text-slate-600">Ubicación<input value={form.ubicacion} onChange={(event) => update('ubicacion', event.target.value)} maxLength={120} className="input-control" placeholder="Ej. Oficina docente" /></label>
        <label className="text-sm text-slate-600">Actividad / descripción<input value={form.descripcion} onChange={(event) => update('descripcion', event.target.value)} maxLength={500} className="input-control" placeholder="Ej. Tutorías, planificación" /></label>
      </div>

      <div className="mt-4">
        <span className="text-sm text-slate-600">Horarios (marque varios días para repetir el mismo horario)</span>
        <div className="mt-2 space-y-2">
          {form.filas.map((fila) => (
            <div key={fila.key} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
              <div className="flex gap-1">
                {DIAS.map((dia) => (
                  <button key={dia.value} type="button" title={dia.value} onClick={() => toggleDia(fila, dia.value)} className={`h-8 w-8 rounded-md border text-xs font-semibold ${fila.dias.includes(dia.value) ? 'border-istl-700 bg-istl-700 text-white' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}>{dia.corto}</button>
                ))}
              </div>
              <input type="time" required value={fila.hora_inicio} onChange={(event) => updateFila(fila.key, { hora_inicio: event.target.value })} className="input-control !mt-0 !w-32" aria-label="Hora de inicio" />
              <span className="text-slate-400">a</span>
              <input type="time" required value={fila.hora_fin} onChange={(event) => updateFila(fila.key, { hora_fin: event.target.value })} className="input-control !mt-0 !w-32" aria-label="Hora de fin" />
              <button type="button" onClick={() => update('filas', form.filas.filter((item) => item.key !== fila.key))} className="ml-auto text-xs font-medium text-red-600 hover:underline">Quitar</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => update('filas', [...form.filas, nuevaFila(['lunes'], '14:00', '17:00')])} className="btn-secondary mt-2">Agregar horario</button>
      </div>

      <p className="mt-4 rounded-md bg-white p-3 text-sm text-slate-600">
        Se {editing ? 'guardarán' : 'crearán'} <strong>{totalBloques} {totalBloques === 1 ? 'bloque' : 'bloques'}</strong> por semana {resumen}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        {editing && <button type="button" onClick={cancelEdit} className="btn-secondary">Cancelar</button>}
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar jornada'}</button>
      </div>
    </form>

    <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-slate-500">{visibles.length} {visibles.length === 1 ? 'jornada' : 'jornadas'}</p>
      <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar docente" className="input-control !mt-0 !w-64" />
    </div>
    <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
      {visibles.map((jornada) => {
        const { principal } = jornada;
        return (
          <div key={jornada.grupoId} className={`flex flex-wrap items-start gap-3 p-3 ${editing === jornada.grupoId ? 'bg-teal-50' : ''}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{principal.docente.apellido} {principal.docente.nombre}</span>
                {jornada.temporal
                  ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Temporal {formatFecha(principal.fecha_inicio)} al {formatFecha(principal.fecha_fin)}</span>
                  : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{principal.periodo_academico.nombre}</span>}
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-istl-700">{modalidadLabel[principal.modalidad] ?? principal.modalidad}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{jornada.filas.map((fila) => `${diasTexto(fila.dias)} ${fila.hora_inicio}–${fila.hora_fin}`).join(' · ')}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {[principal.ubicacion, principal.descripcion].filter(Boolean).join(' · ') || 'Sin ubicación ni actividad'}
                {jornada.temporal && ' · Pausa la jornada regular en esas fechas'}
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => edit(jornada)} className="text-xs font-medium text-istl-700 hover:underline">Editar</button>
              <button type="button" onClick={() => void deactivate(jornada)} className="text-xs font-medium text-red-600 hover:underline">Desactivar</button>
            </div>
          </div>
        );
      })}
      {visibles.length === 0 && <p className="p-4 text-sm text-slate-500">{busqueda ? 'Ningún docente coincide con la búsqueda.' : 'No hay jornadas administrativas configuradas.'}</p>}
    </div>

    <div className="mt-8"><h3 className="text-sm font-semibold uppercase text-slate-500">Marcaciones administrativas recientes</h3><div className="table-container mt-3"><table className="min-w-[700px] w-full divide-y divide-slate-200 text-sm"><thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2 pr-4">Docente</th><th className="py-2 pr-4">Actividad</th><th className="py-2 pr-4">Entrada</th><th className="py-2 pr-4">Salida</th><th className="py-2 pr-4">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{records.map((record) => <tr key={record.id}><td className="py-2 pr-4">{record.horario_administrativo.docente.apellido} {record.horario_administrativo.docente.nombre}</td><td className="py-2 pr-4">{record.horario_administrativo.descripcion || `${record.horario_administrativo.hora_inicio} - ${record.horario_administrativo.hora_fin}`}</td><td className="py-2 pr-4">{record.timestamp_entrada ? new Date(record.timestamp_entrada).toLocaleString('es-EC') : '-'}</td><td className="py-2 pr-4">{record.timestamp_salida ? new Date(record.timestamp_salida).toLocaleString('es-EC') : 'Pendiente'}</td><td className="py-2 pr-4 capitalize">{record.estado}</td></tr>)}{records.length === 0 && <tr><td colSpan={5} className="py-5 text-slate-500">Aún no hay marcaciones administrativas.</td></tr>}</tbody></table></div></div>
  </section>;
}
