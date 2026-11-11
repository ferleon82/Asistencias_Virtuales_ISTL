import { useEffect, useRef } from 'react';

const INTERVALO_MS = 30_000;
/** Margen para que el servidor ya considere abierta la ventana al recargar. */
const MARGEN_MS = 1_000;
/** No se programan recargas a más de 12 horas: la página se recarga antes. */
const MAX_ESPERA_MS = 12 * 60 * 60 * 1000;

/**
 * Mantiene al día un estado del servidor en el teléfono del docente:
 * - lo recarga cada 30 segundos mientras la pantalla está visible;
 * - lo recarga apenas el docente vuelve a la pantalla (el navegador pausa los
 *   temporizadores con el teléfono bloqueado o en otra aplicación);
 * - si se indica `recargarEn`, lo recarga justo en ese instante (por ejemplo,
 *   cuando se habilita la salida).
 */
export function useLiveRefresh(refresh: () => void | Promise<void>, enabled: boolean, recargarEn?: string | null) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return undefined;
    const recargar = () => {
      if (document.visibilityState === 'visible') void refreshRef.current();
    };
    const intervalId = window.setInterval(recargar, INTERVALO_MS);
    window.addEventListener('focus', recargar);
    document.addEventListener('visibilitychange', recargar);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', recargar);
      document.removeEventListener('visibilitychange', recargar);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !recargarEn) return undefined;
    const espera = new Date(recargarEn).getTime() - Date.now() + MARGEN_MS;
    if (!Number.isFinite(espera) || espera <= 0 || espera > MAX_ESPERA_MS) return undefined;
    const timeoutId = window.setTimeout(() => void refreshRef.current(), espera);
    return () => window.clearTimeout(timeoutId);
  }, [enabled, recargarEn]);
}
