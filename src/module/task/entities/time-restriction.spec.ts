import { TimeInterval } from './time-restriction.entity';

describe('TaskTimeRestriction', () => {
  let taskTimeRestriction: TimeInterval;

  beforeEach(() => {
    taskTimeRestriction = new TimeInterval(
      '',
      [1, 3, 5],
      {
        start: '13:00:00',
        end: '19:00:00',
      },
      new Date('2024-01-01T00:00:00.000Z'),
      new Date('2024-12-31T23:59:59.999Z'),
      'America/Argentina/Buenos_Aires',
    ); // Lunes, Miércoles y Viernes de 13 a 19 en Buenos Aires
  });

  it('should initialize with correct values', () => {
    expect(taskTimeRestriction.days).toEqual([1, 3, 5]); // Días Lunes, Miércoles y Viernes
    expect(taskTimeRestriction.time.start).toBe('13:00:00'); // Hora de inicio 13
    expect(taskTimeRestriction.time.end).toBe('19:00:00'); // Hora de fin 19
    expect(taskTimeRestriction.timezone).toBe('America/Argentina/Buenos_Aires');
  });

  describe('satisfy method', () => {
    it('should return true for valid day and time within the restriction using UTC input', () => {
      // 18:00 UTC on Monday Sept 16, 2024 is 15:00 in Buenos Aires (UTC-3)
      const validDate = new Date('2024-09-16T18:00:00.000Z');
      expect(taskTimeRestriction.satisfy(validDate)).toBe(true);
    });

    it('should return true for a date at the exact start time in Buenos Aires', () => {
      // 16:00 UTC is 13:00 Buenos Aires
      const validDate = new Date('2024-09-16T16:00:00.000Z');
      expect(taskTimeRestriction.satisfy(validDate)).toBe(true);
    });

    it('should return false for a date at the exact end time in Buenos Aires', () => {
      // 22:00 UTC is 19:00 Buenos Aires
      const invalidDate = new Date('2024-09-16T22:00:00.000Z');
      expect(taskTimeRestriction.satisfy(invalidDate)).toBe(false);
    });

    it('should return false for invalid day in Buenos Aires', () => {
      // Tuesday Sept 17, 2024 at 15:00 Buenos Aires (18:00 UTC)
      const invalidDate = new Date('2024-09-17T18:00:00.000Z');
      expect(taskTimeRestriction.satisfy(invalidDate)).toBe(false);
    });

    it('should return false for valid day but outside the time range in Buenos Aires', () => {
      // Monday Sept 16, 2024 at 20:00 Buenos Aires (23:00 UTC)
      const invalidTime = new Date('2024-09-16T23:00:00.000Z');
      expect(taskTimeRestriction.satisfy(invalidTime)).toBe(false);
    });

    it('should return false for both invalid day and time', () => {
      // Tuesday Sept 17, 2024 at 20:00 Buenos Aires (23:00 UTC)
      const invalidDayAndTime = new Date('2024-09-17T23:00:00.000Z');
      expect(taskTimeRestriction.satisfy(invalidDayAndTime)).toBe(false);
    });

    it('should return false for a date outside the date range (before)', () => {
      const invalidDate = new Date('2023-12-31T15:00:00.000Z');
      expect(taskTimeRestriction.satisfy(invalidDate)).toBe(false);
    });

    it('should return false for a date outside the date range (after)', () => {
      const invalidDate = new Date('2025-01-01T15:00:00.000Z');
      expect(taskTimeRestriction.satisfy(invalidDate)).toBe(false);
    });

    it('should return false if the restriction name is "unavailable"', () => {
      taskTimeRestriction.name = 'unavailable';
      const validDate = new Date('2024-09-16T18:00:00.000Z');
      expect(taskTimeRestriction.satisfy(validDate)).toBe(false);
    });

    it('should handle Sunday correctly in Buenos Aires even when UTC has rolled over to Monday', () => {
      const sundayRestriction = new TimeInterval(
        '',
        [7], // Domingo
        { start: '21:00', end: '23:30' },
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-12-31T23:59:59.999Z'),
        'America/Argentina/Buenos_Aires',
      );
      // Sunday Sept 22, 2024 at 22:00 in Buenos Aires is Monday Sept 23 at 01:00 UTC!
      const sundayNightUtc = new Date('2024-09-23T01:00:00.000Z');
      expect(sundayRestriction.satisfy(sundayNightUtc)).toBe(true);
    });

    it('should handle string date inputs correctly', () => {
      // Monday at 14:00 Buenos Aires = 17:00 UTC
      const validStringDate = '2024-09-16T17:00:00.000Z';
      expect(taskTimeRestriction.satisfy(validStringDate)).toBe(true);
    });

    it('should support override timezone parameter without hardcoded default in params', () => {
      // 14:00 UTC: In Madrid (UTC+2) it is 16:00 (valid between 13-19).
      // In Buenos Aires (UTC-3) 14:00 UTC is 11:00 (invalid).
      const dateUtc = '2024-09-16T14:00:00.000Z';
      expect(taskTimeRestriction.satisfy(dateUtc, 'Europe/Madrid')).toBe(true);
      expect(
        taskTimeRestriction.satisfy(dateUtc, 'America/Argentina/Buenos_Aires'),
      ).toBe(false);
    });

    it('should support overnight time intervals spanning midnight', () => {
      const overnight = new TimeInterval(
        'Noche',
        [1], // Lunes
        { start: '22:00', end: '04:00' },
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-12-31T23:59:59.999Z'),
        'America/Argentina/Buenos_Aires',
      );

      // Monday at 23:00 ART (Tuesday 02:00 UTC) -> should be valid
      const mondayLateUtc = new Date('2024-09-17T02:00:00.000Z');
      expect(overnight.satisfy(mondayLateUtc)).toBe(true);
    });
  });
});
