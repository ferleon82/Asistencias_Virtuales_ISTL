import { prisma } from '../../config/database';

export interface AttendanceWindowSettings {
  entryBeforeMinutes: number;
  entryAfterMinutes: number;
  exitBeforeMinutes: number;
  exitAfterMinutes: number;
}

export const defaultAttendanceWindows: AttendanceWindowSettings = {
  entryBeforeMinutes: 15,
  entryAfterMinutes: 15,
  exitBeforeMinutes: 10,
  exitAfterMinutes: 15,
};

function minutes(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 120 ? parsed : fallback;
}

export async function getAttendanceWindows(): Promise<AttendanceWindowSettings> {
  const keys = [
    'attendance_entry_before_minutes',
    'attendance_entry_after_minutes',
    'attendance_exit_before_minutes',
    'attendance_exit_after_minutes',
  ] as const;
  const settings = await Promise.all(keys.map((key) => prisma.systemSetting.findUnique({ where: { key }, select: { value: true } })));

  return {
    entryBeforeMinutes: minutes(settings[0]?.value, defaultAttendanceWindows.entryBeforeMinutes),
    entryAfterMinutes: minutes(settings[1]?.value, defaultAttendanceWindows.entryAfterMinutes),
    exitBeforeMinutes: minutes(settings[2]?.value, defaultAttendanceWindows.exitBeforeMinutes),
    exitAfterMinutes: minutes(settings[3]?.value, defaultAttendanceWindows.exitAfterMinutes),
  };
}
