import { prisma } from '../../config/database';

export interface AttendanceWindows {
  entryBeforeMinutes: number;
  entryAfterMinutes: number;
  exitBeforeMinutes: number;
  exitAfterMinutes: number;
}

export interface AttendanceSettings {
  windows: AttendanceWindows;
  photoRequired: boolean;
}

export const defaultAttendanceWindows: AttendanceWindows = {
  entryBeforeMinutes: 15,
  entryAfterMinutes: 15,
  exitBeforeMinutes: 10,
  exitAfterMinutes: 15,
};

const SETTING_KEYS = {
  photoRequired: 'attendance_photo_required',
  entryBeforeMinutes: 'attendance_entry_before_minutes',
  entryAfterMinutes: 'attendance_entry_after_minutes',
  exitBeforeMinutes: 'attendance_exit_before_minutes',
  exitAfterMinutes: 'attendance_exit_after_minutes',
} as const;

function minutes(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && Number.isInteger(parsed) && parsed >= 0 && parsed <= 120 ? parsed : fallback;
}

/** Lee en una sola consulta las ventanas de marcado y si la foto es obligatoria. */
export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
    select: { key: true, value: true },
  });
  const value = (key: string) => rows.find((row) => row.key === key)?.value;

  return {
    windows: {
      entryBeforeMinutes: minutes(value(SETTING_KEYS.entryBeforeMinutes), defaultAttendanceWindows.entryBeforeMinutes),
      entryAfterMinutes: minutes(value(SETTING_KEYS.entryAfterMinutes), defaultAttendanceWindows.entryAfterMinutes),
      exitBeforeMinutes: minutes(value(SETTING_KEYS.exitBeforeMinutes), defaultAttendanceWindows.exitBeforeMinutes),
      exitAfterMinutes: minutes(value(SETTING_KEYS.exitAfterMinutes), defaultAttendanceWindows.exitAfterMinutes),
    },
    // Sin configuración guardada se mantiene el comportamiento histórico: foto obligatoria.
    photoRequired: value(SETTING_KEYS.photoRequired) !== 'false',
  };
}
