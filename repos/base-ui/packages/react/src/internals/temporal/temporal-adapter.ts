import { TemporalTimezone, TemporalSupportedObject, TemporalSupportedValue } from './temporal';

export interface TemporalAdapterFormats {
  /**
   * The 4-digit year.
   * @example "2019"
   */
  yearPadded: string;
  /**
   * The month with leading zeros.
   * @example "08"
   */
  monthPadded: string;
  /**
   * The day of the month with leading zeros.
   * @example "01"
   */
  dayOfMonthPadded: string;
  /**
   * The hours with leading zeros, 24-hour clock.
   * @example "01", "23"
   */
  hours24hPadded: string;
  /**
   * The hours with leading zeros, 12-hour clock.
   * @example "01", "11"
   */
  hours12hPadded: string;
  /**
   * The minutes with leading zeros.
   * @example "01", "59"
   */
  minutesPadded: string;
  /**
   * The seconds with leading zeros.
   * @example "01", "59"
   */
  secondsPadded: string;
  /**
   * The day of the month without leading zeros.
   * @example "1"
   */
  dayOfMonth: string;
  /**
   * The hours without leading zeros, 24-hour clock.
   * @example "1", "23"
   */
  hours24h: string;
  /**
   * The hours without leading zeros, 12-hour clock.
   * @example "1", "11"
   */
  hours12h: string;
  /**
   * The abbreviated month name.
   * @example "Aug"
   */
  month3Letters: string;
  /**
   * The full month name.
   * @example "August"
   */
  monthFullLetter: string;
  /**
   * The week day name.
   * @example "Wednesday"
   */
  weekday: string;
  /**
   * The abbreviated week day name.
   * @example "Wed"
   * */
  weekday3Letters: string;
  /**
   * The initial of the week day name.
   * @example "W"
   * */
  weekday1Letter: string;
  /**
   * The meridiem.
   * @example "AM"
   */
  meridiem: string;
  /**
   * The localized date format including year, month, day and weekday.
   * @example "Wednesday, August 6, 2014"
   */
  localizedDateWithFullMonthAndWeekDay: string;
  /**
   * The localized numeric date format including year, month and day.
   * @example "8/6/2014"
   */
  localizedNumericDate: string;
}

export type DateBuilderReturnType<T extends string | null> = [T] extends [null]
  ? null
  : TemporalSupportedObject;

export interface TemporalAdapter {
  isTimezoneCompatible: boolean;
  formats: TemporalAdapterFormats;
  /**
   * Name of the library that is used right now.
   */
  lib: string;
  /**
   * Characters used to escape a string inside a format.
   */
  escapedCharacters: { start: string; end: string };
  /**
   * Creates a date in the date library format.
   */
  date<T extends string | null>(value: T, timezone: TemporalTimezone): DateBuilderReturnType<T>;
  /**
   * Parses a date from a string in the given format.
   */
  parse(value: string, format: string, timezone: TemporalTimezone): TemporalSupportedObject;
  /**
   * Creates a date in the date library format for the current time.
   */
  now(timezone: TemporalTimezone): TemporalSupportedObject;
  /**
   * Extracts the timezone from a date.
   */
  getTimezone(value: TemporalSupportedValue | null): TemporalTimezone;
  /**
   * Converts a date to another timezone.
   */
  setTimezone(value: TemporalSupportedObject, timezone: TemporalTimezone): TemporalSupportedObject;
  /**
   * Converts a date in the library format into a JavaScript `Date` object.
   */
  toJsDate(value: TemporalSupportedObject): Date;
  /**
   * Gets the code of the locale currently used by the adapter.
   */
  getCurrentLocaleCode(): string;
  /**
   * Checks if the date is valid.
   */
  isValid(value: TemporalSupportedValue): value is TemporalSupportedObject;
  /**
   * Formats a date using an adapter format string (see the `AdapterFormats` interface).
   */
  format(value: TemporalSupportedObject, formatKey: keyof TemporalAdapterFormats): string;
  /**
   * Formats a date using a format of the date library.
   */
  formatByString(value: TemporalSupportedObject, formatString: string): string;
  /**
   * Checks if the two dates are equal (which means they represent the same timestamp).
   */
  isEqual(value: TemporalSupportedValue, comparing: TemporalSupportedValue): boolean;
  /**
   * Checks if the two dates are in the same year.
   * Uses the timezone of the `value`.
   */
  isSameYear(value: TemporalSupportedObject, comparing: TemporalSupportedObject): boolean;
  /**
   * Checks if the two dates are in the same month.
   * Uses the timezone of the `value`.
   */
  isSameMonth(value: TemporalSupportedObject, comparing: TemporalSupportedObject): boolean;
  /**
   * Checks if the two dates are in the same day.
   * Uses the timezone of the `value`.
   */
  isSameDay(value: TemporalSupportedObject, comparing: TemporalSupportedObject): boolean;
  /**
   * Checks if the two dates are at the same hour.
   * Uses the timezone of the `value`.
   */
  isSameHour(value: TemporalSupportedObject, comparing: TemporalSupportedObject): boolean;
  /**
   * Checks if the `value` date is after the `comparing` date.
   */
  isAfter(value: TemporalSupportedObject, comparing: TemporalSupportedObject): boolean;
  /**
   * Checks if the `value` date is before the `comparing` date.
   */
  isBefore(value: TemporalSupportedObject, comparing: TemporalSupportedObject): boolean;
  /**
   * Checks if the value is within the provided range.
   */
  isWithinRange(
    value: TemporalSupportedObject,
    range: [TemporalSupportedObject, TemporalSupportedObject],
  ): boolean;
  /**
   * Returns the start of the year for the given date.
   */
  startOfYear(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the start of the month for the given date.
   */
  startOfMonth(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the start of the week for the given date.
   */
  startOfWeek(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the start of the day for the given date.
   */
  startOfDay(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the start of the hour for the given date.
   */
  startOfHour(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the start of the minute for the given date.
   */
  startOfMinute(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the start of the second for the given date.
   */
  startOfSecond(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the end of the year for the given date.
   */
  endOfYear(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the end of the month for the given date.
   */
  endOfMonth(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the end of the week for the given date.
   */
  endOfWeek(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the end of the day for the given date.
   */
  endOfDay(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the end of the hour for the given date.
   */
  endOfHour(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the end of the minute for the given date.
   */
  endOfMinute(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Returns the end of the second for the given date.
   */
  endOfSecond(value: TemporalSupportedObject): TemporalSupportedObject;
  /**
   * Adds the specified number of years to the given date.
   */
  addYears(value: TemporalSupportedObject, amount: number): TemporalSupportedObject;
  /**
   * Adds the specified number of months to the given date.
   */
  addMonths(value: TemporalSupportedObject, amount: number): TemporalSupportedObject;
  /**
   * Adds the specified number of weeks to the given date.
   */
  addWeeks(value: TemporalSupportedObject, amount: number): TemporalSupportedObject;
  /**
   * Adds the specified number of days to the given date.
   */
  addDays(value: TemporalSupportedObject, amount: number): TemporalSupportedObject;
  /**
   * Adds the specified number of hours to the given date.
   */
  addHours(value: TemporalSupportedObject, amount: number): TemporalSupportedObject;
  /**
   * Adds the specified number of minutes to the given date.
   */
  addMinutes(value: TemporalSupportedObject, amount: number): TemporalSupportedObject;
  /**
   * Adds the specified number of seconds to the given date.
   */
  addSeconds(value: TemporalSupportedObject, amount: number): TemporalSupportedObject;
  /**
   * Adds the specified number of milliseconds to the given date.
   */
  addMilliseconds(value: TemporalSupportedObject, amount: number): TemporalSupportedObject;
  /**
   * Gets the year of the given date.
   */
  getYear(value: TemporalSupportedObject): number;
  /**
   * Gets the month of the given date.
   * The value is 0-based, in the Gregorian calendar January = 0, February = 1, ...
   */
  getMonth(value: TemporalSupportedObject): number;
  /**
   * Gets the date (day in the month) of the given date.
   */
  getDate(value: TemporalSupportedObject): number;
  /**
   * Gets the hours of the given date.
   */
  getHours(value: TemporalSupportedObject): number;
  /**
   * Gets the minutes of the given date.
   */
  getMinutes(value: TemporalSupportedObject): number;
  /**
   * Gets the seconds of the given date.
   */
  getSeconds(value: TemporalSupportedObject): number;
  /**
   * Gets the milliseconds of the given date.
   */
  getMilliseconds(value: TemporalSupportedObject): number;
  /**
   * Gets the time since epoch of the given date.
   */
  getTime(value: TemporalSupportedObject): number;
  /**
   * Sets the year to the given date.
   */
  setYear(value: TemporalSupportedObject, year: number): TemporalSupportedObject;
  /**
   * Sets the month to the given date.
   */
  setMonth(value: TemporalSupportedObject, month: number): TemporalSupportedObject;
  /**
   * Sets the date (day in the month) to the given date.
   */
  setDate(value: TemporalSupportedObject, date: number): TemporalSupportedObject;
  /**
   * Sets the hours to the given date.
   */
  setHours(value: TemporalSupportedObject, hours: number): TemporalSupportedObject;
  /**
   * Sets the minutes to the given date.
   */
  setMinutes(value: TemporalSupportedObject, minutes: number): TemporalSupportedObject;
  /**
   * Sets the seconds to the given date.
   */
  setSeconds(value: TemporalSupportedObject, seconds: number): TemporalSupportedObject;
  /**
   * Sets the milliseconds to the given date.
   */
  setMilliseconds(value: TemporalSupportedObject, milliseconds: number): TemporalSupportedObject;
  /**
   * Gets the number of full years between the given dates.
   */
  differenceInYears: (value: TemporalSupportedObject, comparing: TemporalSupportedObject) => number;
  /**
   * Gets the number of full months between the given dates.
   */
  differenceInMonths: (
    value: TemporalSupportedObject,
    comparing: TemporalSupportedObject,
  ) => number;
  /**
   * Gets the number of full weeks between the given dates.
   */
  differenceInWeeks: (value: TemporalSupportedObject, comparing: TemporalSupportedObject) => number;
  /**
   * Gets the number of full days between the given dates.
   */
  differenceInDays: (value: TemporalSupportedObject, comparing: TemporalSupportedObject) => number;
  /**
   * Gets the number of full hours between the given dates.
   */
  differenceInHours: (value: TemporalSupportedObject, comparing: TemporalSupportedObject) => number;
  /**
   * Gets the number of full minutes between the given dates.
   */
  differenceInMinutes: (
    value: TemporalSupportedObject,
    comparing: TemporalSupportedObject,
  ) => number;
  /**
   * Gets the number of days in a month of the given date.
   */
  getDaysInMonth(value: TemporalSupportedObject): number;
  /**
   * Gets the number of the week of the given date.
   */
  getWeekNumber(value: TemporalSupportedObject): number;
  /**
   * Gets the number of the day of the week of the given date.
   * The value is 1-based, 1 - first day of the week, 7 - last day of the week.
   */
  getDayOfWeek(value: TemporalSupportedObject): number;
}
