// Utilidades nativas de fecha (sin date-fns en backend)

export const ECUADOR_TZ = 'America/Guayaquil';

const DATE_TIME_FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
  'dd/MM/yyyy HH:mm': {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },
};

/**
 * Obtiene la fecha/hora actual en zona horaria de Ecuador (UTC-5).
 */
export function nowInEcuador(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: ECUADOR_TZ }));
}

/**
 * Formatea una fecha al formato DD/MM/YYYY HH:mm en hora Ecuador.
 */
export function formatEcuador(date: Date | string, fmt = 'dd/MM/yyyy HH:mm'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formatOptions = DATE_TIME_FORMATS[fmt];

  if (!formatOptions) {
    throw new Error(`Formato de fecha no soportado: ${fmt}`);
  }

  return new Intl.DateTimeFormat('es-EC', {
    ...formatOptions,
    timeZone: ECUADOR_TZ,
  }).format(d);
}

/**
 * Determina el estado de asistencia según la hora de marcado vs hora del horario.
 *
 * @param markedAt   - Timestamp cuando el docente marcó asistencia
 * @param scheduleStart - Hora de inicio del horario (en formato HH:mm)
 * @param scheduleDate  - Fecha del día de clase (Date)
 * @returns 'puntual' | 'tardanza' | 'fuera_de_ventana'
 */
export function calcularEstadoAsistencia(
  markedAt: Date,
  scheduleStart: string, // "HH:mm"
  scheduleDate: Date
): 'puntual' | 'tardanza' | 'fuera_de_ventana' {
  const [hours, minutes] = scheduleStart.split(':').map(Number);

  // Construir datetime exacto del inicio de clase
  const classStart = new Date(scheduleDate);
  classStart.setHours(hours, minutes, 0, 0);

  // Ventana permitida: -15 min antes hasta +15 min después
  const windowStart = addMinutes(classStart, -15);
  const windowEnd = addMinutes(classStart, 15);

  if (markedAt < windowStart || markedAt > windowEnd) {
    return 'fuera_de_ventana';
  }

  // Puntual: dentro de los primeros 5 minutos del inicio
  const diffMinutes = differenceInMinutes(markedAt, classStart);

  if (diffMinutes <= 5) {
    return 'puntual';
  }

  return 'tardanza';
}

/**
 * Verifica si la hora actual está dentro de la ventana de marcado (±15 min).
 */
export function estaEnVentanaMarcado(scheduleStart: string, scheduleDate: Date): boolean {
  const now = nowInEcuador();
  const resultado = calcularEstadoAsistencia(now, scheduleStart, scheduleDate);
  return resultado !== 'fuera_de_ventana';
}

/**
 * Convierte un día de semana de nombre a número (0=domingo, 1=lunes...).
 */
export const DIA_SEMANA_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function differenceInMinutes(dateLeft: Date, dateRight: Date): number {
  return Math.trunc((dateLeft.getTime() - dateRight.getTime()) / 60_000);
}
