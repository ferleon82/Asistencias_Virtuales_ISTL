import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/axios';
import { getApiMessage } from '../../../lib/apiError';
import type { DiaNoLaborable } from '../types';

export interface NuevoDiaNoLaborable {
  fecha_inicio: string;
  fecha_fin: string;
  descripcion: string;
}

const emptyForm: NuevoDiaNoLaborable = { fecha_inicio: '', fecha_fin: '', descripcion: '' };

/** Calendario institucional de días no laborables (feriados). */
export function useDiasNoLaborables(enabled: boolean) {
  const [dias, setDias] = useState<DiaNoLaborable[]>([]);
  const [form, setForm] = useState<NuevoDiaNoLaborable>(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data } = await api.get('/calendario/dias-no-laborables');
      setDias(data.data);
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo cargar el calendario de feriados.'));
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/calendario/dias-no-laborables', {
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin || undefined,
        descripcion: form.descripcion,
      });
      setMessage(data.message ?? 'Día no laborable registrado.');
      setForm(emptyForm);
      await load();
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo registrar el día no laborable.'));
    } finally {
      setLoading(false);
    }
  };

  const remove = async (dia: DiaNoLaborable) => {
    if (!window.confirm(`Confirme que desea eliminar el feriado del ${dia.fecha.split('-').reverse().join('/')} (${dia.descripcion}).`)) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.delete(`/calendario/dias-no-laborables/${dia.id}`);
      setMessage(data.message ?? 'Día no laborable eliminado.');
      await load();
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo eliminar el día no laborable.'));
    } finally {
      setLoading(false);
    }
  };

  return { dias, form, setForm, message, error, loading, create, remove };
}
