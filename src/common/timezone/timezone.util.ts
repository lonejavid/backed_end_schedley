import { format, parseISO, startOfDay, endOfDay, addMinutes } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function localTimeToUtc(
  date: Date,
  localTimeStr: string,
  timezone: string,
): Date {
  const parts = localTimeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const seconds = parts[2] ?? 0;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setHours(hours, minutes, seconds, 0);
  return zonedTimeToUtc(d, timezone);
}

export function utcToLocalTimeString(utcDate: Date, timezone: string): string {
  const zoned = utcToZonedTime(utcDate, timezone);
  return format(zoned, 'HH:mm');
}

export function utcToZonedDate(utcDate: Date, timezone: string): Date {
  return utcToZonedTime(utcDate, timezone);
}

export function startOfDayUtc(dateStr: string, timezone: string): Date {
  const zonedStart = startOfDay(parseISO(dateStr));
  return zonedTimeToUtc(zonedStart, timezone);
}

export function endOfDayUtc(dateStr: string, timezone: string): Date {
  const zonedEnd = endOfDay(parseISO(dateStr));
  return zonedTimeToUtc(zonedEnd, timezone);
}

export interface SlotRange {
  start: Date;
  end: Date;
}

export function generateSlotsForDay(
  dateStr: string,
  dayStartLocal: string,
  dayEndLocal: string,
  slotDurationMinutes: number,
  timezone: string,
): SlotRange[] {
  const date = parseISO(dateStr);
  const startUtc = localTimeToUtc(date, dayStartLocal, timezone);
  const endUtc = localTimeToUtc(date, dayEndLocal, timezone);
  const slots: SlotRange[] = [];
  let current = new Date(startUtc);
  while (current < endUtc) {
    const end = addMinutes(current, slotDurationMinutes);
    if (end <= endUtc) {
      slots.push({ start: new Date(current), end });
    }
    current = end;
  }
  return slots;
}

export function normalizeTimeStr(t: string): string {
  const parts = t.trim().split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
