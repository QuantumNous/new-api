// Intentionally ignore TS issues in this file to avoid docs being built with `| DateTime`
// TODO: Remove if temporal adapters are supported
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
'use client';
import { DateTime, Info } from 'luxon';
import {
  TemporalAdapterFormats,
  DateBuilderReturnType,
  TemporalTimezone,
  TemporalAdapter,
} from '../temporal';

const FORMATS: TemporalAdapterFormats = {
  // Digit formats with leading zeroes
  yearPadded: 'yyyy',
  monthPadded: 'MM',
  dayOfMonthPadded: 'dd',
  hours24hPadded: 'HH',
  hours12hPadded: 'hh',
  minutesPadded: 'mm',
  secondsPadded: 'ss',

  // Digit formats without leading zeroes
  dayOfMonth: 'd',
  hours24h: 'H',
  hours12h: 'h',

  // Letter formats
  month3Letters: 'MMM',
  monthFullLetter: 'MMMM',
  weekday: 'cccc',
  weekday3Letters: 'ccc',
  weekday1Letter: 'ccccc',
  meridiem: 'a',

  // Full formats
  localizedDateWithFullMonthAndWeekDay: 'DDDD',
  localizedNumericDate: 'D',
  fullMonthAndYear: 'MMMM yyyy',
};

// Temporarily disabled to avoid docs being built with `| DateTime`
// declare module '@base-ui/react/internals/temporal' {
//   interface TemporalSupportedObjectLookup {
//     luxon: DateTime;
//   }
// }

export class TemporalAdapterLuxon implements TemporalAdapter {
  public isTimezoneCompatible = true;

  public lib = 'luxon';

  private locale: string;

  public formats: TemporalAdapterFormats = FORMATS;

  public escapedCharacters = { start: "'", end: "'" };

  constructor({ locale }: TemporalAdapterLuxon.ConstructorParameters = {}) {
    this.locale = locale ?? 'en-US';
  }

  private setLocaleToValue = (value: DateTime) => {
    const expectedLocale = this.getCurrentLocaleCode();
    if (expectedLocale === value.locale) {
      return value;
    }

    return value.setLocale(expectedLocale);
  };

  public now = (timezone: TemporalTimezone) => {
    // @ts-expect-error locale is not identified as a field
    return DateTime.fromJSDate(new Date(), { locale: this.locale, zone: timezone });
  };

  public date = <T extends string | null>(
    value: T,
    timezone: TemporalTimezone,
  ): DateBuilderReturnType<T> => {
    if (value === null) {
      return null;
    }

    return DateTime.fromISO(value, { locale: this.locale, zone: timezone });
  };

  public parse = (value: string, format: string, timezone: TemporalTimezone): DateTime => {
    return DateTime.fromFormat(value, format, { locale: this.locale, zone: timezone });
  };

  public getTimezone = (value: DateTime): string => {
    // When using the system zone, we want to return "system", not something like "Europe/Paris"
    if (value.zone.type === 'system') {
      return 'system';
    }

    return value.zoneName!;
  };

  public setTimezone = (value: DateTime, timezone: TemporalTimezone): DateTime => {
    if (!value.zone.equals(Info.normalizeZone(timezone))) {
      return value.setZone(timezone);
    }

    return value;
  };

  public toJsDate = (value: DateTime) => {
    return value.toJSDate();
  };

  public getCurrentLocaleCode = () => {
    return this.locale;
  };

  public isValid = (value: DateTime | null): value is DateTime => {
    if (value == null) {
      return false;
    }

    return value.isValid;
  };

  public format = (value: DateTime, formatKey: keyof TemporalAdapterFormats) => {
    return this.formatByString(value, this.formats[formatKey]);
  };

  public formatByString = (value: DateTime, format: string) => {
    return value.setLocale(this.locale).toFormat(format);
  };

  public isEqual = (value: DateTime | null, comparing: DateTime | null) => {
    if (value === null && comparing === null) {
      return true;
    }

    if (value === null || comparing === null) {
      return false;
    }

    return +value === +comparing;
  };

  public isSameYear = (value: DateTime, comparing: DateTime) => {
    const comparingInValueTimezone = this.setTimezone(comparing, this.getTimezone(value));
    return value.hasSame(comparingInValueTimezone, 'year');
  };

  public isSameMonth = (value: DateTime, comparing: DateTime) => {
    const comparingInValueTimezone = this.setTimezone(comparing, this.getTimezone(value));
    return value.hasSame(comparingInValueTimezone, 'month');
  };

  public isSameDay = (value: DateTime, comparing: DateTime) => {
    const comparingInValueTimezone = this.setTimezone(comparing, this.getTimezone(value));
    return value.hasSame(comparingInValueTimezone, 'day');
  };

  public isSameHour = (value: DateTime, comparing: DateTime) => {
    const comparingInValueTimezone = this.setTimezone(comparing, this.getTimezone(value));
    return value.hasSame(comparingInValueTimezone, 'hour');
  };

  public isAfter = (value: DateTime, comparing: DateTime) => {
    return value > comparing;
  };

  public isBefore = (value: DateTime, comparing: DateTime) => {
    return value < comparing;
  };

  public isWithinRange = (value: DateTime, [start, end]: [DateTime, DateTime]) => {
    if (this.isAfter(value, start) && this.isBefore(value, end)) {
      return true;
    }

    return this.isEqual(value, start) || this.isEqual(value, end);
  };

  public startOfYear = (value: DateTime) => {
    return value.startOf('year');
  };

  public startOfMonth = (value: DateTime) => {
    return value.startOf('month');
  };

  public startOfWeek = (value: DateTime) => {
    return this.setLocaleToValue(value).startOf('week', { useLocaleWeeks: true });
  };

  public startOfDay = (value: DateTime) => {
    return value.startOf('day');
  };

  public startOfHour = (value: DateTime) => {
    return value.startOf('hour');
  };

  public startOfMinute = (value: DateTime) => {
    return value.startOf('minute');
  };

  public startOfSecond = (value: DateTime) => {
    return value.startOf('second');
  };

  public endOfYear = (value: DateTime) => {
    return value.endOf('year');
  };

  public endOfMonth = (value: DateTime) => {
    return value.endOf('month');
  };

  public endOfWeek = (value: DateTime) => {
    return this.setLocaleToValue(value).endOf('week', { useLocaleWeeks: true });
  };

  public endOfDay = (value: DateTime) => {
    return value.endOf('day');
  };

  public endOfHour = (value: DateTime) => {
    return value.endOf('hour');
  };

  public endOfMinute = (value: DateTime) => {
    return value.endOf('minute');
  };

  public endOfSecond = (value: DateTime) => {
    return value.endOf('second');
  };

  public addYears = (value: DateTime, amount: number) => {
    return value.plus({ years: amount });
  };

  public addMonths = (value: DateTime, amount: number) => {
    return value.plus({ months: amount });
  };

  public addWeeks = (value: DateTime, amount: number) => {
    return value.plus({ weeks: amount });
  };

  public addDays = (value: DateTime, amount: number) => {
    return value.plus({ days: amount });
  };

  public addHours = (value: DateTime, amount: number) => {
    return value.plus({ hours: amount });
  };

  public addMinutes = (value: DateTime, amount: number) => {
    return value.plus({ minutes: amount });
  };

  public addSeconds = (value: DateTime, amount: number) => {
    return value.plus({ seconds: amount });
  };

  public addMilliseconds = (value: DateTime, amount: number) => {
    return value.plus({ milliseconds: amount });
  };

  public getYear = (value: DateTime) => {
    return value.get('year');
  };

  public getMonth = (value: DateTime) => {
    // See https://github.com/moment/luxon/blob/master/docs/moment.md#major-functional-differences
    return value.get('month') - 1;
  };

  public getDate = (value: DateTime) => {
    return value.get('day');
  };

  public getHours = (value: DateTime) => {
    return value.get('hour');
  };

  public getMinutes = (value: DateTime) => {
    return value.get('minute');
  };

  public getSeconds = (value: DateTime) => {
    return value.get('second');
  };

  public getMilliseconds = (value: DateTime) => {
    return value.get('millisecond');
  };

  public getTime = (value: DateTime): number => {
    return value.toMillis();
  };

  public setYear = (value: DateTime, year: number) => {
    return value.set({ year });
  };

  public setMonth = (value: DateTime, month: number) => {
    // See https://github.com/moment/luxon/blob/master/docs/moment.md#major-functional-differences
    return value.set({ month: month + 1 });
  };

  public setDate = (value: DateTime, date: number) => {
    return value.set({ day: date });
  };

  public setHours = (value: DateTime, hours: number) => {
    return value.set({ hour: hours });
  };

  public setMinutes = (value: DateTime, minutes: number) => {
    return value.set({ minute: minutes });
  };

  public setSeconds = (value: DateTime, seconds: number) => {
    return value.set({ second: seconds });
  };

  public setMilliseconds = (value: DateTime, milliseconds: number) => {
    return value.set({ millisecond: milliseconds });
  };

  public differenceInYears = (value: DateTime, comparing: DateTime): number => {
    return Math.floor(value.diff(comparing, 'years').as('years'));
  };

  public differenceInMonths = (value: DateTime, comparing: DateTime): number => {
    return Math.floor(value.diff(comparing, 'months').as('months'));
  };

  public differenceInWeeks = (value: DateTime, comparing: DateTime): number => {
    return Math.floor(value.diff(comparing, 'weeks').as('weeks'));
  };

  public differenceInDays = (value: DateTime, comparing: DateTime): number => {
    return Math.floor(value.diff(comparing, 'days').as('days'));
  };

  public differenceInHours = (value: DateTime, comparing: DateTime): number => {
    return Math.floor(value.diff(comparing, 'hours').as('hours'));
  };

  public differenceInMinutes = (value: DateTime, comparing: DateTime): number => {
    return Math.floor(value.diff(comparing, 'minutes').as('minutes'));
  };

  public getDaysInMonth = (value: DateTime) => {
    return value.daysInMonth!;
  };

  public getWeekNumber = (value: DateTime) => {
    /* istanbul ignore next */
    return value.localWeekNumber ?? value.weekNumber;
  };

  public getDayOfWeek = (value: DateTime) => {
    /* istanbul ignore next */
    return value.localWeekday ?? value.weekday;
  };
}

export namespace TemporalAdapterLuxon {
  export interface ConstructorParameters {
    /**
     * The locale to use for formatting and parsing dates.
     * @default 'en-US'
     */
    locale?: string | undefined;
  }
}
