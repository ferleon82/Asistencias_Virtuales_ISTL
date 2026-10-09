import type { Request } from 'express';

/**
 * IP real del cliente. Depende de `app.set('trust proxy', ...)`: Express solo
 * toma X-Forwarded-For de los saltos de proxy configurados como confiables,
 * así el valor no puede falsificarse enviando la cabecera desde el navegador.
 */
export function getClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
