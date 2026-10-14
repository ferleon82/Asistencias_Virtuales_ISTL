import type { HorarioItem } from './types';

const DIA_ORDEN: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

export const DIA_CORTO: Record<string, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sáb',
};

/** Jornada semanal tal como se muestra en la lista: una materia y docente con sus bloques. */
export interface ScheduleGroup {
  key: string;
  /** Asignación docente; `null` en horarios antiguos creados antes de las asignaciones. */
  asignacionId: string | null;
  horarios: HorarioItem[];
  principal: HorarioItem;
  horasSemana: number;
}

export function compareBloques(a: Pick<HorarioItem, 'dia_semana' | 'hora_inicio'>, b: Pick<HorarioItem, 'dia_semana' | 'hora_inicio'>): number {
  return (DIA_ORDEN[a.dia_semana] ?? 9) - (DIA_ORDEN[b.dia_semana] ?? 9) || a.hora_inicio.localeCompare(b.hora_inicio);
}

export function horasEntre(inicio: string, fin: string): number {
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fin.split(':').map(Number);
  return Math.max(0, (hf * 60 + mf - (hi * 60 + mi)) / 60);
}

export function formatHoras(horas: number): string {
  const redondeado = Math.round(horas * 10) / 10;
  return `${String(redondeado).replace('.', ',')} h`;
}

/** Agrupa los horarios por asignación docente, con sus bloques ordenados por día y hora. */
export function groupSchedules(horarios: HorarioItem[]): ScheduleGroup[] {
  const groups = new Map<string, HorarioItem[]>();
  horarios.forEach((horario) => {
    const asignacionId = horario.asignacion_docente_id ?? horario.asignacion_docente?.id ?? null;
    const key = asignacionId ?? `horario:${horario.id}`;
    groups.set(key, [...(groups.get(key) ?? []), horario]);
  });

  return Array.from(groups.entries()).map(([key, items]) => {
    const bloques = [...items].sort(compareBloques);
    return {
      key,
      asignacionId: key.startsWith('horario:') ? null : key,
      horarios: bloques,
      principal: bloques[0],
      horasSemana: bloques.reduce((total, horario) => total + horasEntre(horario.hora_inicio, horario.hora_fin), 0),
    };
  });
}

/** Clave de la asignación docente: materia, docente, período, jornada y paralelo. */
export function asignacionKey(horario: HorarioItem): string {
  return [
    horario.materia_id,
    horario.docente_id ?? '',
    horario.periodo_academico_id ?? '',
    horario.jornada,
    horario.asignacion_docente?.paralelo ?? 'A',
  ].join('|');
}

/**
 * Jornada a editar al pulsar "Editar jornada". Un horario antiguo sin asignación
 * se edita junto con la jornada existente de la misma materia y docente (si
 * hay una), para incorporarlo a ella en lugar de crear otra jornada.
 */
export function jornadaParaEditar(group: ScheduleGroup, groups: ScheduleGroup[]): ScheduleGroup {
  if (group.asignacionId) return group;
  const destino = groups.find((item) => item.asignacionId && asignacionKey(item.principal) === asignacionKey(group.principal));
  if (!destino) return group;
  const horarios = [...destino.horarios, ...group.horarios].sort(compareBloques);
  return { ...destino, horarios, horasSemana: destino.horasSemana + group.horasSemana };
}
