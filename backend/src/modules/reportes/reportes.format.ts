import { ECUADOR_TZ } from '../../shared/attendance/clock';
import type { ReportRow } from './reportes.types';

export function formatDateTime(date: Date | null): string {
  if (!date) return '';

  return new Intl.DateTimeFormat('es-EC', {
    timeZone: ECUADOR_TZ,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function formatLocation(row: ReportRow): string {
  if (row.lat === null || row.lng === null) {
    return 'Sin GPS';
  }

  const precision = row.precision_m ? ` / ${row.precision_m} m` : '';
  return `${row.lat.toFixed(6)}, ${row.lng.toFixed(6)}${precision}`;
}

export function googleMapsUrl(row: ReportRow): string | null {
  if (row.lat === null || row.lng === null) {
    return null;
  }

  return `https://www.google.com/maps?q=${row.lat},${row.lng}`;
}
