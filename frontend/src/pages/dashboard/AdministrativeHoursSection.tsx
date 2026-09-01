import { useEffect, useState, type FormEvent } from 'react';
import api from '../../lib/axios';
import type { DocenteOption, PeriodoAcademicoOption } from './types';

interface AdministrativeSchedule {
  id: string; docente_id: string; periodo_academico_id: string; dia_semana: string; hora_inicio: string; hora_fin: string; jornada: string; modalidad: string; ubicacion?: string | null; descripcion?: string | null; activo: boolean;
  docente: { nombre: string; apellido: string }; periodo_academico: { nombre: string };
}
interface AdministrativeRecord {
  id: string; timestamp_entrada?: string | null; timestamp_salida?: string | null; estado: string;
  horario_administrativo: { hora_inicio: string; hora_fin: string; descripcion?: string | null; docente: { nombre: string; apellido: string } };
}
interface Props { docentes: DocenteOption[]; periodos: PeriodoAcademicoOption[]; }
const initial = { docente_id: '', periodo_academico_id: '', dia_semana: 'lunes', hora_inicio: '08:00', hora_fin: '11:00', jornada: 'matutina', modalidad: 'presencial', ubicacion: '', descripcion: '' };
function errorMessage(error: unknown) { return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo completar la operación.'; }

export function AdministrativeHoursSection({ docentes, periodos }: Props) {
  const [items, setItems] = useState<AdministrativeSchedule[]>([]);
  const [records, setRecords] = useState<AdministrativeRecord[]>([]);
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = async () => { try { const [schedulesResponse, recordsResponse] = await Promise.all([api.get('/horas-administrativas?activo=true'), api.get('/horas-administrativas/registros')]); setItems(schedulesResponse.data.data); setRecords(recordsResponse.data.data); } catch (requestError) { setError(errorMessage(requestError)); } };
  useEffect(() => { void load(); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(''); setMessage(''); try { await api.post('/horas-administrativas', form); setForm(initial); setMessage('Hora administrativa configurada correctamente.'); await load(); } catch (requestError) { setError(errorMessage(requestError)); } finally { setLoading(false); } };
  const deactivate = async (id: string) => { if (!window.confirm('¿Desea desactivar este bloque administrativo?')) return; setError(''); try { await api.delete(`/horas-administrativas/${id}`); await load(); } catch (requestError) { setError(errorMessage(requestError)); } };
  const update = (key: keyof typeof initial, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <section className="dashboard-section">
    <div><h2 className="section-title">Horas administrativas</h2><p className="section-subtitle">Configure los bloques no académicos de cada docente. Solo Talento Humano puede administrarlos.</p></div>
    {message && <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-istl-700">{message}</div>}
    {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <form onSubmit={(event) => void submit(event)} className="mt-5 grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm text-slate-600">Docente<select required value={form.docente_id} onChange={(event) => update('docente_id', event.target.value)} className="input-control"><option value="">Seleccione</option>{docentes.map((item) => <option key={item.id} value={item.id}>{item.apellido} {item.nombre}</option>)}</select></label>
      <label className="text-sm text-slate-600">Período<select required value={form.periodo_academico_id} onChange={(event) => update('periodo_academico_id', event.target.value)} className="input-control"><option value="">Seleccione</option>{periodos.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
      <label className="text-sm text-slate-600">Día<select value={form.dia_semana} onChange={(event) => update('dia_semana', event.target.value)} className="input-control">{['lunes','martes','miercoles','jueves','viernes','sabado'].map((day) => <option key={day} value={day}>{day}</option>)}</select></label>
      <label className="text-sm text-slate-600">Jornada<select value={form.jornada} onChange={(event) => update('jornada', event.target.value)} className="input-control">{['matutina','vespertina','nocturna'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="text-sm text-slate-600">Inicio<input type="time" required value={form.hora_inicio} onChange={(event) => update('hora_inicio', event.target.value)} className="input-control" /></label>
      <label className="text-sm text-slate-600">Fin<input type="time" required value={form.hora_fin} onChange={(event) => update('hora_fin', event.target.value)} className="input-control" /></label>
      <label className="text-sm text-slate-600">Ubicación<input value={form.ubicacion} onChange={(event) => update('ubicacion', event.target.value)} className="input-control" placeholder="Ej. Oficina docente" /></label>
      <label className="text-sm text-slate-600">Modalidad<select value={form.modalidad} onChange={(event) => update('modalidad', event.target.value)} className="input-control"><option value="presencial">Presencial</option><option value="virtual">Virtual</option><option value="hibrida">Híbrida</option></select></label>
      <label className="text-sm text-slate-600 md:col-span-2 xl:col-span-3">Actividad / descripción<input value={form.descripcion} onChange={(event) => update('descripcion', event.target.value)} className="input-control" placeholder="Ej. Tutorías, planificación, atención estudiantil" /></label>
      <div className="flex items-end"><button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Guardando...' : 'Agregar bloque'}</button></div>
    </form>
    <div className="table-container mt-6"><table className="min-w-[800px] w-full divide-y divide-slate-200 text-sm"><thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2 pr-4">Docente</th><th className="py-2 pr-4">Período</th><th className="py-2 pr-4">Día</th><th className="py-2 pr-4">Horario</th><th className="py-2 pr-4">Ubicación</th><th className="py-2 pr-4">Acción</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="py-2 pr-4">{item.docente.apellido} {item.docente.nombre}</td><td className="py-2 pr-4">{item.periodo_academico.nombre}</td><td className="py-2 pr-4 capitalize">{item.dia_semana}</td><td className="py-2 pr-4">{item.hora_inicio} - {item.hora_fin}</td><td className="py-2 pr-4">{item.ubicacion || '-'}</td><td className="py-2 pr-4"><button type="button" onClick={() => void deactivate(item.id)} className="text-xs font-medium text-red-600 hover:underline">Desactivar</button></td></tr>)}{items.length === 0 && <tr><td colSpan={6} className="py-5 text-slate-500">No hay bloques administrativos configurados.</td></tr>}</tbody></table></div>
    <div className="mt-8"><h3 className="text-sm font-semibold uppercase text-slate-500">Marcaciones administrativas recientes</h3><div className="table-container mt-3"><table className="min-w-[700px] w-full divide-y divide-slate-200 text-sm"><thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2 pr-4">Docente</th><th className="py-2 pr-4">Actividad</th><th className="py-2 pr-4">Entrada</th><th className="py-2 pr-4">Salida</th><th className="py-2 pr-4">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{records.map((record) => <tr key={record.id}><td className="py-2 pr-4">{record.horario_administrativo.docente.apellido} {record.horario_administrativo.docente.nombre}</td><td className="py-2 pr-4">{record.horario_administrativo.descripcion || `${record.horario_administrativo.hora_inicio} - ${record.horario_administrativo.hora_fin}`}</td><td className="py-2 pr-4">{record.timestamp_entrada ? new Date(record.timestamp_entrada).toLocaleString('es-EC') : '-'}</td><td className="py-2 pr-4">{record.timestamp_salida ? new Date(record.timestamp_salida).toLocaleString('es-EC') : 'Pendiente'}</td><td className="py-2 pr-4 capitalize">{record.estado}</td></tr>)}{records.length === 0 && <tr><td colSpan={5} className="py-5 text-slate-500">Aún no hay marcaciones administrativas.</td></tr>}</tbody></table></div></div>
  </section>;
}
