import { useMemo, useState } from 'react';
import type { DocenteOption } from './types';

interface Props {
  docentes: DocenteOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Docentes que ya tienen jornada regular en el período elegido. */
  conJornada?: Set<string>;
}

const nombre = (docente: DocenteOption) => `${docente.apellido} ${docente.nombre}`;

/** Lista con casillas y búsqueda para elegir varios docentes a la vez. */
export function DocentesPicker({ docentes, selected, onChange, conJornada }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const marcados = useMemo(() => new Set(selected), [selected]);
  const ordenados = useMemo(() => [...docentes].sort((a, b) => nombre(a).localeCompare(nombre(b))), [docentes]);
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return texto ? ordenados.filter((docente) => nombre(docente).toLowerCase().includes(texto)) : ordenados;
  }, [busqueda, ordenados]);
  const elegidos = ordenados.filter((docente) => marcados.has(docente.id));

  const toggle = (id: string) => onChange(marcados.has(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const marcarVisibles = () => onChange([...new Set([...selected, ...visibles.map((docente) => docente.id)])]);

  return <div>
    <div className="mt-1 flex min-h-[1.75rem] flex-wrap gap-1.5">
      {elegidos.map((docente) => (
        <span key={docente.id} className="inline-flex items-center gap-1 rounded-full bg-teal-50 py-0.5 pl-2 pr-1 text-xs text-istl-700">
          {nombre(docente)}
          <button type="button" onClick={() => toggle(docente.id)} className="rounded-full px-1 hover:bg-teal-100" aria-label={`Quitar a ${nombre(docente)}`}>×</button>
        </span>
      ))}
      {elegidos.length === 0 && <span className="text-xs text-slate-400">Ningún docente seleccionado</span>}
    </div>
    <div className="mt-1.5 rounded-md border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
        <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por apellido o nombre" className="input-control !mt-0 min-w-0 flex-1" />
        <button type="button" onClick={marcarVisibles} disabled={visibles.length === 0} className="btn-secondary !py-1.5 text-xs">Marcar {busqueda.trim() ? `los ${visibles.length} visibles` : 'todos'}</button>
        <button type="button" onClick={() => onChange([])} disabled={selected.length === 0} className="btn-secondary !py-1.5 text-xs">Limpiar</button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {visibles.map((docente) => (
          <label key={docente.id} className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50">
            <input type="checkbox" checked={marcados.has(docente.id)} onChange={() => toggle(docente.id)} className="h-4 w-4 accent-istl-700" />
            <span className="flex-1">{nombre(docente)}</span>
            {conJornada?.has(docente.id) && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Ya tiene jornada</span>}
          </label>
        ))}
        {visibles.length === 0 && <p className="p-3 text-sm text-slate-500">Ningún docente coincide con la búsqueda.</p>}
      </div>
    </div>
  </div>;
}
