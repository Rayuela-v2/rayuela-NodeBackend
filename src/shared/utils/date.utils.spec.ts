import { getZonedDateParts, isValidIanaTimezone } from './date.utils';
import { DEFAULT_PROJECT_TIMEZONE } from '../../module/project/project.constants';

describe('DateUtils', () => {
  describe('isValidIanaTimezone', () => {
    it('should return true for valid IANA timezones', () => {
      expect(isValidIanaTimezone('America/Argentina/Buenos_Aires')).toBe(true);
      expect(isValidIanaTimezone('UTC')).toBe(true);
      expect(isValidIanaTimezone('Europe/Madrid')).toBe(true);
      expect(isValidIanaTimezone('America/Sao_Paulo')).toBe(true);
    });

    it('should return false for invalid timezones', () => {
      expect(isValidIanaTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidIanaTimezone('')).toBe(false);
      expect(isValidIanaTimezone('NotATimezone')).toBe(false);
      expect(isValidIanaTimezone(null as any)).toBe(false);
      expect(isValidIanaTimezone(undefined as any)).toBe(false);
    });
  });

  describe('getZonedDateParts', () => {
    it('should convert UTC instant to Buenos Aires time correctly', () => {
      // 12:30 UTC on Wednesday Oct 14, 2026 -> 09:30 ART (UTC-3)
      const utcString = '2026-10-14T12:30:00.000Z';
      const parts = getZonedDateParts(utcString, DEFAULT_PROJECT_TIMEZONE);

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(10);
      expect(parts.day).toBe(14);
      expect(parts.hour).toBe(9);
      expect(parts.minute).toBe(30);
      expect(parts.second).toBe(0);
      expect(parts.dayOfWeek).toBe(3); // Wednesday (1=Mon, 2=Tue, 3=Wed, ..., 7=Sun)
    });

    it('should handle day-of-week rollover (Sunday night in Buenos Aires vs Monday morning in UTC)', () => {
      // 01:30 UTC on Monday Oct 19, 2026 -> 22:30 ART on Sunday Oct 18, 2026
      const utcString = '2026-10-19T01:30:00.000Z';
      const parts = getZonedDateParts(utcString, DEFAULT_PROJECT_TIMEZONE);

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(10);
      expect(parts.day).toBe(18); // Sunday in Buenos Aires
      expect(parts.hour).toBe(22);
      expect(parts.minute).toBe(30);
      expect(parts.dayOfWeek).toBe(7); // Sunday
    });

    it('should convert UTC instant to Madrid time correctly', () => {
      // In October (CEST = UTC+2): 12:30 UTC -> 14:30 Madrid
      const utcString = '2026-10-14T12:30:00.000Z';
      const parts = getZonedDateParts(utcString, 'Europe/Madrid');

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(10);
      expect(parts.day).toBe(14);
      expect(parts.hour).toBe(14);
      expect(parts.minute).toBe(30);
      expect(parts.dayOfWeek).toBe(3);
    });

    it('should accept Date instances as input', () => {
      const date = new Date('2026-10-14T12:30:00.000Z');
      const parts = getZonedDateParts(date, DEFAULT_PROJECT_TIMEZONE);

      expect(parts.hour).toBe(9);
      expect(parts.minute).toBe(30);
    });

    it('should throw an error if an invalid timezone is supplied', () => {
      expect(() =>
        getZonedDateParts('2026-10-14T12:30:00.000Z', 'Invalid/Zone'),
      ).toThrow('Invalid IANA timezone: "Invalid/Zone"');
    });
  });
});
