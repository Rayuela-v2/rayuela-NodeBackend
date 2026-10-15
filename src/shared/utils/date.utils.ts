export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO weekday: 1 for Monday through 7 for Sunday */
  dayOfWeek: number;
}

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Validates if a string is a recognized IANA timezone identifier.
 */
export function isValidIanaTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a UTC Date, ISO string, or timestamp into broken-down calendar parts
 * localized to a target IANA timezone using native Intl.DateTimeFormat.
 */
export function getZonedDateParts(
  date: Date | string | number,
  timeZone: string,
): ZonedDateParts {
  if (!isValidIanaTimezone(timeZone)) {
    throw new Error(`Invalid IANA timezone: "${timeZone}"`);
  }

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date provided: "${date}"`);
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(d).map((p) => [p.type, p.value]),
  );

  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    dayOfWeek: WEEKDAY_TO_ISO[parts.weekday] ?? 1,
  };
}
