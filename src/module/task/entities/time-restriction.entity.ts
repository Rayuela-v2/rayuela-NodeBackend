import { getZonedDateParts } from '../../../shared/utils/date.utils';
import { DEFAULT_PROJECT_TIMEZONE } from '../../project/project.constants';

export class TimeInterval {
  name: string;
  days: number[]; // From 1(Mon) to 7(Sun)
  startDate: Date;
  endDate: Date;
  time: {
    // Between 00 and 23
    start: string; // e.g., "08:00" or "14:30:00"
    end: string;
  };
  timezone?: string;

  satisfy(date: Date | string, timezone?: string): boolean {
    if (this.name === 'unavailable') {
      return false;
    }
    const datetime = new Date(date);
    if (isNaN(datetime.getTime())) {
      return false;
    }

    const resolvedTimezone =
      timezone || this.timezone || DEFAULT_PROJECT_TIMEZONE;
    const local = getZonedDateParts(datetime, resolvedTimezone);

    const isValidDay = this.days.includes(local.dayOfWeek);
    const isValidHour = this.isValidHour(local.hour, local.minute);

    const isWithinDateRange =
      datetime >= new Date(this.startDate) &&
      datetime <= new Date(this.endDate);

    return isValidDay && isValidHour && isWithinDateRange;
  }

  private isValidHour(currentHour: number, currentMinute: number): boolean {
    const [startHour, startMinute = 0] = this.time.start.split(':').map(Number);
    const [endHour, endMinute = 0] = this.time.end.split(':').map(Number);

    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    if (startTotalMinutes <= endTotalMinutes) {
      return (
        currentTotalMinutes >= startTotalMinutes &&
        currentTotalMinutes < endTotalMinutes
      );
    }

    // Handles intervals spanning midnight (e.g. 22:00 to 04:00)
    return (
      currentTotalMinutes >= startTotalMinutes ||
      currentTotalMinutes < endTotalMinutes
    );
  }

  constructor(
    name: string,
    days: number[],
    time: { start: string; end: string },
    startDate: Date,
    endDate: Date,
    timezone?: string,
  ) {
    this.name = name;
    this.startDate = startDate;
    this.endDate = endDate;
    this.days = days;
    this.time = time;
    this.timezone = timezone;
  }
}
