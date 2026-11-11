/** Agrupación y formato de las jornadas administrativas (bloques con el mismo `grupo_id`). */

export const DIAS = [
  { value: 'lunes', corto: 'L', nombre: 'lun' },
  { value: 'martes', corto: 'M', nombre: 'mar' },
  { value: 'miercoles', corto: 'X', nombre: 'mié' },
  { value: 'jueves', corto: 'J', nombre: 'jue' },
  { value: 'viernes', corto: 'V', nombre: 'vie' },
  { value: 'sabado', corto: 'S', nombre: 'sáb' },
] as const;

const ORDEN_DIA: Record<string, number> = Object.fromEntries(DIAS.map((dia, index) => [dia.value, index]));

export interface AdministrativeBlock {
  id: string;
  grupo_id: string;
  temporal: boolean;
  docente_id: string;
  periodo_academico_id: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  modalidad: string;
  ubicacion?: string | null;
  descripcion?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  docente: { nombre: string; apellido: string };
  periodo_academico: { nombre: string };
}

/** Un horario del formulario: el mismo inicio y fin para varios días. */
export interface HorarioFila {
  key: string;
  dias: string[];
  hora_inicio: string;
  hora_fin: string;
}

export interface AdministrativeJornada {
  grupoId: string;
  temporal: boolean;
  principal: AdministrativeBlock;
  bloques: AdministrativeBlock[];
  filas: HorarioFila[];
}

let filaSeq = 0;
export function nuevaFila(dias: string[] = ['lunes'], hora_inicio = '08:00', hora_fin = '13:00'): HorarioFila {
  filaSeq += 1;
  return { key: `fila-${filaSeq}`, dias, hora_inicio, hora_fin };
}

/** Junta los bloques con el mismo horario en una fila con varios días. */
export function filasDeBloques(bloques: Array<Pick<AdministrativeBlock, 'dia_semana' | 'hora_inicio' | 'hora_fin'>>): HorarioFila[] {
  const filas = new Map<string, HorarioFila>();
  [...bloques]
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio) || ORDEN_DIA[a.dia_semana] - ORDEN_DIA[b.dia_semana])
    .forEach((bloque) => {
      const key = `${bloque.hora_inicio}-${bloque.hora_fin}`;
      const fila = filas.get(key) ?? nuevaFila([], bloque.hora_inicio, bloque.hora_fin);
      if (!fila.dias.includes(bloque.dia_semana)) fila.dias.push(bloque.dia_semana);
      filas.set(key, fila);
    });
  return [...filas.values()];
}

export function agruparJornadas(bloques: AdministrativeBlock[]): AdministrativeJornada[] {
  const grupos = new Map<string, AdministrativeBlock[]>();
  bloques.forEach((bloque) => grupos.set(bloque.grupo_id, [...(grupos.get(bloque.grupo_id) ?? []), bloque]));
  return [...grupos.entries()]
    .map(([grupoId, items]) => ({ grupoId, temporal: items[0].temporal, principal: items[0], bloques: items, filas: filasDeBloques(items) }))
    .sort(
      (a, b) =>
        `${a.principal.docente.apellido} ${a.principal.docente.nombre}`.localeCompare(`${b.principal.docente.apellido} ${b.principal.docente.nombre}`) ||
        Number(a.temporal) - Number(b.temporal) ||
        a.principal.fecha_inicio.localeCompare(b.principal.fecha_inicio)
    );
}

/** "lun a vie", "lun, mié" o "sáb". */
export function diasTexto(dias: string[]): string {
  const indices = dias.map((dia) => ORDEN_DIA[dia]).sort((a, b) => a - b);
  const seguidos = indices.length >= 3 && indices[indices.length - 1] - indices[0] === indices.length - 1;
  if (seguidos) return `${DIAS[indices[0]].nombre} a ${DIAS[indices[indices.length - 1]].nombre}`;
  return indices.map((index) => DIAS[index].nombre).join(', ');
}

/** Fecha de hoy en Ecuador como `YYYY-MM-DD`. */
export function hoyEcuador(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
}

/** `dd/mm/yyyy` de una fecha ISO o `YYYY-MM-DD`. */
export function formatFecha(fecha: string): string {
  return fecha.slice(0, 10).split('-').reverse().join('/');
}
