import { expect } from 'vitest';
// TODO Temporal: Replace with `@base-ui/react/types` import when Temporal components will become public.
import {
  TemporalAdapter,
  TemporalSupportedObject,
  TemporalTimezone,
} from '../../src/internals/temporal';
import { DescribeGregorianAdapterTestSuite } from './describeGregorianAdapter.types';
import { TEST_DATE_ISO_STRING, TEST_DATE_LOCALE_STRING } from './describeGregorianAdapter.utils';

/**
 * To check if the date has the right offset even after changing its date parts,
 * we convert it to a different timezone that always has the same offset,
 * then we check that both dates have the same hour value.
 */
// We change to
const expectSameTimeInMonacoTZ = (adapter: TemporalAdapter, value: TemporalSupportedObject) => {
  const valueInMonacoTz = adapter.setTimezone(value, 'Europe/Monaco');
  expect(adapter.getHours(value)).toBe(adapter.getHours(valueInMonacoTz));
};

export const testComputations: DescribeGregorianAdapterTestSuite = ({
  adapter,
  adapterTZ = adapter,
  adapterFr,
  setDefaultTimezone,
  createDateInFrenchLocale,
}) => {
  const testDateIso = adapter.date(TEST_DATE_ISO_STRING, 'default');
  const testDateIsoInSystemTz = adapter.date(TEST_DATE_ISO_STRING, 'system');
  const testDateIsoFr = createDateInFrenchLocale(TEST_DATE_ISO_STRING);
  const testDateLastNonDSTDay = adapterTZ.isTimezoneCompatible
    ? adapterTZ.date('2022-03-27', 'Europe/Paris')
    : adapterTZ.date('2022-03-27', 'default');
  const testDateLocale = adapter.date(TEST_DATE_LOCALE_STRING, 'default');

  describe('Method: date', () => {
    it('should parse ISO strings', () => {
      if (adapter.isTimezoneCompatible) {
        const test = (timezone: TemporalTimezone, expectedTimezones: string = timezone) => {
          [adapterTZ, adapterFr].forEach((instance) => {
            const dateWithZone = instance.date(TEST_DATE_ISO_STRING, timezone);
            expect(instance.getTimezone(dateWithZone)).toBe(expectedTimezones);

            // Should keep the time of the value in the UTC timezone
            expect(dateWithZone).toEqualDateTime(TEST_DATE_ISO_STRING);
          });
        };

        test('UTC');
        test('system');
        test('America/New_York');
        test('Europe/Paris');

        if (setDefaultTimezone != null) {
          setDefaultTimezone('America/New_York');
          test('default', 'America/New_York');

          setDefaultTimezone('Europe/Paris');
          test('default', 'Europe/Paris');

          // Reset to the default timezone
          setDefaultTimezone(undefined);
        }
      } else {
        expect(adapter.date(TEST_DATE_ISO_STRING, 'system')).toEqualDateTime(TEST_DATE_ISO_STRING);
        expect(adapter.date(TEST_DATE_ISO_STRING, 'default')).toEqualDateTime(TEST_DATE_ISO_STRING);
      }
    });

    it('should parse locale strings', () => {
      if (adapter.isTimezoneCompatible) {
        const test = (timezone: TemporalTimezone) => {
          [adapterTZ, adapterFr].forEach((instance) => {
            const dateWithZone = instance.date(TEST_DATE_LOCALE_STRING, timezone);
            expect(instance.getTimezone(dateWithZone)).toBe(timezone);

            // Should keep the time of the date in the target timezone
            expect(instance.format(dateWithZone, 'hours24hPadded')).toBe('00');
          });
        };

        test('UTC');
        test('system');
        test('America/New_York');
        test('Europe/Paris');
      } else {
        expect(adapter.date(TEST_DATE_LOCALE_STRING, 'system')).toEqualDateTime(
          TEST_DATE_LOCALE_STRING,
        );
      }
    });

    it('should parse null', () => {
      expect(adapter.date(null, 'system')).toBe(null);

      if (adapter.isTimezoneCompatible) {
        expect(adapter.date(null, 'UTC')).toBe(null);
        expect(adapter.date(null, 'America/New_York')).toBe(null);
      }
    });
  });

  describe('Method: date', () => {
    it('should parse custom strings', () => {
      // RFC5545 format: YYYYMMDDTHHmmssZ
      const f = adapter.formats;
      const dateFormat = `${f.yearPadded}${f.monthPadded}${f.dayOfMonthPadded}`;
      const dateTimeSeparator = `${adapter.escapedCharacters.start}T${adapter.escapedCharacters.end}`;
      const timeFormat = `${f.hours24hPadded}${f.minutesPadded}${f.secondsPadded}`;
      const timezoneSuffix = `${adapter.escapedCharacters.start}Z${adapter.escapedCharacters.end}`;
      const format = `${dateFormat}${dateTimeSeparator}${timeFormat}${timezoneSuffix}`;

      expect(adapter.parse('20181030T114400Z', format, 'default')).toEqualDateTime(
        '2018-10-30T11:44:00.000Z',
      );
    });
  });

  describe('Method: now', () => {
    test.skipIf(adapterTZ.lib !== 'dayjs')('should support system timezone', () => {
      if (adapter.isTimezoneCompatible) {
        const testTodayZone = (timezone: TemporalTimezone) => {
          const dateWithZone = adapterTZ.now(timezone);
          expect(adapterTZ.getTimezone(dateWithZone)).toBe(timezone);
          expect(Math.abs(adapterTZ.toJsDate(dateWithZone).getTime() - Date.now())).toBeLessThan(5);
        };

        testTodayZone('system');
        testTodayZone('UTC');
        testTodayZone('America/New_York');
      } else {
        expect(
          Math.abs(adapterTZ.toJsDate(adapter.now('system')).getTime() - Date.now()),
        ).toBeLessThan(5);
      }
    });
  });

  test.skipIf(!adapter.isTimezoneCompatible)('Method: getTimezone', () => {
    const testTimezone = (timezone: string, expectedTimezone = timezone) => {
      expect(adapter.getTimezone(adapter.now(timezone))).toBe(expectedTimezone);
    };

    testTimezone('system');
    testTimezone('Europe/Paris');
    testTimezone('America/New_York');
    testTimezone('UTC');

    if (setDefaultTimezone != null) {
      setDefaultTimezone('America/Chicago');
      testTimezone('default', 'America/Chicago');
      setDefaultTimezone(undefined);
    }
  });

  test.skipIf(!adapter.isTimezoneCompatible)(
    'should not mix Europe/London and UTC in winter',
    () => {
      const dateWithZone = adapter.date('2023-10-30T11:44:00.000Z', 'Europe/London');
      expect(adapter.getTimezone(dateWithZone)).toBe('Europe/London');
    },
  );

  describe('Method: setTimezone', () => {
    it.skipIf(!adapter.isTimezoneCompatible)(
      'should convert the date to the target timezone without impacting its timestamp',
      () => {
        const dateWithLocaleTimezone = adapter.date(TEST_DATE_ISO_STRING, 'system');

        const testTimezone = (timezone: TemporalTimezone) => {
          const dateInTargetTimezone = adapter.setTimezone(dateWithLocaleTimezone, timezone);
          expect(adapter.getTimezone(dateInTargetTimezone)).toBe(timezone);
          expect(adapter.toJsDate(dateInTargetTimezone).getTime()).toBe(
            adapter.toJsDate(dateWithLocaleTimezone).getTime(),
          );
        };

        testTimezone('America/New_York');
        testTimezone('Europe/Paris');
        testTimezone('Australia/Sydney');
        testTimezone('UTC');
      },
    );

    test.skipIf(!adapter.isTimezoneCompatible || setDefaultTimezone == null)(
      'should convert the date to the default timezone',
      () => {
        setDefaultTimezone!('America/New_York');
        expect(adapter.getTimezone(adapter.setTimezone(testDateIsoInSystemTz, 'default'))).toBe(
          'America/New_York',
        );

        setDefaultTimezone!('Europe/Paris');
        expect(adapter.getTimezone(adapter.setTimezone(testDateIsoInSystemTz, 'default'))).toBe(
          'Europe/Paris',
        );

        setDefaultTimezone!(undefined);
      },
    );

    test.skipIf(!adapter.isTimezoneCompatible)(
      'should do nothing if the adapter does not support timezones',
      () => {
        const systemDate = adapter.date(TEST_DATE_ISO_STRING, 'system');
        expect(adapter.setTimezone(systemDate, 'default')).toEqualDateTime(systemDate);
        expect(adapter.setTimezone(systemDate, 'system')).toEqualDateTime(systemDate);

        const defaultDate = adapter.date(TEST_DATE_ISO_STRING, 'default');
        expect(adapter.setTimezone(systemDate, 'default')).toEqualDateTime(defaultDate);
        expect(adapter.setTimezone(systemDate, 'system')).toEqualDateTime(defaultDate);
      },
    );
  });

  it('Method: toJsDate', () => {
    expect(adapter.toJsDate(testDateIso)).toBeInstanceOf(Date);
    expect(adapter.toJsDate(testDateLocale)).toBeInstanceOf(Date);
  });

  it('Method: isValid', () => {
    const invalidDate = adapter.date('2018-42-30T11:60:00.000Z', 'default');

    expect(adapter.isValid(testDateIso)).toBe(true);
    expect(adapter.isValid(testDateLocale)).toBe(true);
    expect(adapter.isValid(invalidDate)).toBe(false);
    expect(adapter.isValid(null)).toBe(false);
  });

  describe('Method: isEqual', () => {
    it('should work in the same timezone', () => {
      expect(adapter.isEqual(adapter.date(null, 'default'), null)).toBe(true);
      expect(adapter.isEqual(testDateIso, adapter.date(TEST_DATE_ISO_STRING, 'default'))).toBe(
        true,
      );
      expect(adapter.isEqual(null, testDateIso)).toBe(false);
      expect(
        adapter.isEqual(testDateLocale, adapter.date(TEST_DATE_LOCALE_STRING, 'default')),
      ).toBe(true);
      expect(adapter.isEqual(null, testDateLocale)).toBe(false);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with different timezones', () => {
      const dateInLondonTZ = adapterTZ.setTimezone(testDateIso, 'Europe/London');
      const dateInParisTZ = adapterTZ.setTimezone(testDateIso, 'Europe/Paris');

      expect(adapterTZ.isEqual(dateInLondonTZ, dateInParisTZ)).toBe(true);
    });
  });

  describe('Method: isSameYear', () => {
    it('should work in the same timezone', () => {
      expect(
        adapter.isSameYear(testDateIso, adapter.date('2018-10-01T00:00:00.000Z', 'default')),
      ).toBe(true);
      expect(
        adapter.isSameYear(testDateIso, adapter.date('2019-10-01T00:00:00.000Z', 'default')),
      ).toBe(false);
      expect(
        adapter.isSameYear(testDateLocale, adapter.date('2018-10-01T00:00:00.000Z', 'default')),
      ).toBe(true);
      expect(
        adapter.isSameYear(testDateLocale, adapter.date('2019-10-01T00:00:00.000Z', 'default')),
      ).toBe(false);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with different timezones', () => {
      // Both dates below have the same timestamp, but they are not in the same year when represented in their respective timezone.
      // The adapter should still consider that they are in the same year.
      const dateInLondonTZ = adapterTZ.endOfYear(
        adapterTZ.setTimezone(testDateIso, 'Europe/London'),
      );
      const dateInParisTZ = adapterTZ.setTimezone(dateInLondonTZ, 'Europe/Paris');

      expect(adapterTZ.isSameYear(dateInLondonTZ, dateInParisTZ)).toBe(true);
      expect(adapterTZ.isSameYear(dateInParisTZ, dateInLondonTZ)).toBe(true);
    });
  });

  describe('Method: isSameMonth', () => {
    it('should work in the same timezone', () => {
      expect(
        adapter.isSameMonth(testDateIso, adapter.date('2018-10-01T00:00:00.000Z', 'default')),
      ).toBe(true);
      expect(
        adapter.isSameMonth(testDateIso, adapter.date('2019-10-01T00:00:00.000Z', 'default')),
      ).toBe(false);
      expect(
        adapter.isSameMonth(testDateLocale, adapter.date('2018-10-01T00:00:00.000Z', 'default')),
      ).toBe(true);
      expect(
        adapter.isSameMonth(testDateLocale, adapter.date('2019-10-01T00:00:00.000Z', 'default')),
      ).toBe(false);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with different timezones', () => {
      // Both dates below have the same timestamp, but they are not in the same month when represented in their respective timezone.
      // The adapter should still consider that they are in the same month.
      const dateInLondonTZ = adapterTZ.endOfMonth(
        adapterTZ.setTimezone(testDateIso, 'Europe/London'),
      );
      const dateInParisTZ = adapterTZ.setTimezone(dateInLondonTZ, 'Europe/Paris');

      expect(adapterTZ.isSameMonth(dateInLondonTZ, dateInParisTZ)).toBe(true);
      expect(adapterTZ.isSameMonth(dateInParisTZ, dateInLondonTZ)).toBe(true);
    });
  });

  describe('Method: isSameDay', () => {
    it('should work in the same timezone', () => {
      expect(
        adapter.isSameDay(testDateIso, adapter.date('2018-10-30T00:00:00.000Z', 'default')),
      ).toBe(true);
      expect(
        adapter.isSameDay(testDateIso, adapter.date('2019-10-30T00:00:00.000Z', 'default')),
      ).toBe(false);
      expect(
        adapter.isSameDay(testDateLocale, adapter.date('2018-10-30T00:00:00.000Z', 'default')),
      ).toBe(true);
      expect(
        adapter.isSameDay(testDateLocale, adapter.date('2019-10-30T00:00:00.000Z', 'default')),
      ).toBe(false);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with different timezones', () => {
      // Both dates below have the same timestamp, but they are not in the same day when represented in their respective timezone.
      // The adapter should still consider that they are in the same day.
      const dateInLondonTZ = adapterTZ.endOfDay(
        adapterTZ.setTimezone(testDateIso, 'Europe/London'),
      );
      const dateInParisTZ = adapterTZ.setTimezone(dateInLondonTZ, 'Europe/Paris');

      expect(adapterTZ.isSameDay(dateInLondonTZ, dateInParisTZ)).toBe(true);
      expect(adapterTZ.isSameDay(dateInParisTZ, dateInLondonTZ)).toBe(true);
    });
  });

  describe('Method: isSameHour', () => {
    it('should work in the same timezone', () => {
      expect(
        adapter.isSameHour(testDateIso, adapter.date('2018-10-30T11:00:00.000Z', 'default')),
      ).toBe(true);
      expect(
        adapter.isSameHour(testDateIso, adapter.date('2018-10-30T12:00:00.000Z', 'default')),
      ).toBe(false);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with different timezones', () => {
      // Both dates below have the same timestamp, but they are not in the same day when represented in their respective timezone.
      // The adapter should still consider that they are in the same day.
      const dateInLondonTZ = adapterTZ.setTimezone(testDateIso, 'Europe/London');
      const dateInParisTZ = adapterTZ.setTimezone(dateInLondonTZ, 'Europe/Paris');

      expect(adapterTZ.isSameHour(dateInLondonTZ, dateInParisTZ)).toBe(true);
      expect(adapterTZ.isSameHour(dateInParisTZ, dateInLondonTZ)).toBe(true);
    });
  });

  describe('Method: isAfter', () => {
    it('should work with the same timezone', () => {
      expect(adapter.isAfter(adapter.now('default'), testDateIso)).toBe(true);
      expect(adapter.isAfter(testDateIso, adapter.now('default'))).toBe(false);

      expect(adapter.isAfter(adapter.now('default'), testDateLocale)).toBe(true);
      expect(adapter.isAfter(testDateLocale, adapter.now('default'))).toBe(false);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with different timezones', () => {
      const dateInLondonTZ = adapterTZ.endOfDay(
        adapterTZ.setTimezone(testDateIso, 'Europe/London'),
      );
      const dateInParisTZ = adapterTZ.addMinutes(
        adapterTZ.endOfDay(adapterTZ.setTimezone(testDateIso, 'Europe/Paris')),
        30,
      );

      expect(adapter.isAfter(dateInLondonTZ, dateInParisTZ)).toBe(true);
      expect(adapter.isAfter(dateInParisTZ, dateInLondonTZ)).toBe(false);
    });
  });

  describe('Method: isBefore', () => {
    it('should work with the same timezone', () => {
      expect(adapter.isBefore(testDateIso, adapter.now('default'))).toBe(true);
      expect(adapter.isBefore(adapter.now('default'), testDateIso)).toBe(false);

      expect(adapter.isBefore(testDateLocale, adapter.now('default'))).toBe(true);
      expect(adapter.isBefore(adapter.now('default'), testDateLocale)).toBe(false);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with different timezones', () => {
      const dateInLondonTZ = adapterTZ.endOfDay(
        adapterTZ.setTimezone(testDateIso, 'Europe/London'),
      );
      const dateInParisTZ = adapterTZ.addMinutes(
        adapterTZ.endOfDay(adapterTZ.setTimezone(testDateIso, 'Europe/Paris')),
        30,
      );

      expect(adapter.isBefore(dateInLondonTZ, dateInParisTZ)).toBe(false);
      expect(adapter.isBefore(dateInParisTZ, dateInLondonTZ)).toBe(true);
    });
  });

  describe('Method: isWithinRange', () => {
    it('should work on simple examples', () => {
      expect(
        adapter.isWithinRange(adapter.date('2019-10-01T00:00:00.000Z', 'default'), [
          adapter.date('2019-09-01T00:00:00.000Z', 'default'),
          adapter.date('2019-11-01T00:00:00.000Z', 'default'),
        ]),
      ).toBe(true);

      expect(
        adapter.isWithinRange(adapter.date('2019-12-01T00:00:00.000Z', 'default'), [
          adapter.date('2019-09-01T00:00:00.000Z', 'default'),
          adapter.date('2019-11-01T00:00:00.000Z', 'default'),
        ]),
      ).toBe(false);

      expect(
        adapter.isWithinRange(adapter.date('2019-10-01', 'default'), [
          adapter.date('2019-09-01', 'default'),
          adapter.date('2019-11-01', 'default'),
        ]),
      ).toBe(true);

      expect(
        adapter.isWithinRange(adapter.date('2019-12-01', 'default'), [
          adapter.date('2019-09-01', 'default'),
          adapter.date('2019-11-01', 'default'),
        ]),
      ).toBe(false);
    });

    it('should use inclusiveness of range', () => {
      expect(
        adapter.isWithinRange(adapter.date('2019-09-01T00:00:00.000Z', 'default'), [
          adapter.date('2019-09-01T00:00:00.000Z', 'default'),
          adapter.date('2019-12-01T00:00:00.000Z', 'default'),
        ]),
      ).toBe(true);

      expect(
        adapter.isWithinRange(adapter.date('2019-12-01T00:00:00.000Z', 'default'), [
          adapter.date('2019-09-01T00:00:00.000Z', 'default'),
          adapter.date('2019-12-01T00:00:00.000Z', 'default'),
        ]),
      ).toBe(true);

      expect(
        adapter.isWithinRange(adapter.date('2019-09-01', 'default'), [
          adapter.date('2019-09-01', 'default'),
          adapter.date('2019-12-01', 'default'),
        ]),
      ).toBe(true);

      expect(
        adapter.isWithinRange(adapter.date('2019-12-01', 'default'), [
          adapter.date('2019-09-01', 'default'),
          adapter.date('2019-12-01', 'default'),
        ]),
      ).toBe(true);
    });

    it('should be equal with values in different locales', () => {
      expect(
        adapter.isWithinRange(adapter.date('2022-04-17', 'default'), [
          adapterFr.date('2022-04-17', 'default'),
          adapterFr.date('2022-04-19', 'default'),
        ]),
      ).toBe(true);
    });
  });

  it('Method: startOfYear', () => {
    const expected = '2018-01-01T00:00:00.000Z';
    expect(adapter.startOfYear(testDateIso)).toEqualDateTime(expected);
    expect(adapter.startOfYear(testDateLocale)).toEqualDateTime(expected);
  });

  it('Method: startOfMonth', () => {
    const expected = '2018-10-01T00:00:00.000Z';
    expect(adapter.startOfMonth(testDateIso)).toEqualDateTime(expected);
    expect(adapter.startOfMonth(testDateLocale)).toEqualDateTime(expected);
  });

  describe('Method: startOfWeek', () => {
    it('should handle basic use-cases', () => {
      expect(adapter.startOfWeek(testDateIso)).toEqualDateTime('2018-10-28T00:00:00.000Z');
      expect(adapter.startOfWeek(testDateLocale)).toEqualDateTime('2018-10-28T00:00:00.000Z');
    });

    it('should use the adapter locale when the date has another locale', () => {
      expect(adapter.startOfWeek(testDateIsoFr)).toEqualDateTime('2018-10-28T00:00:00.000Z');
    });
  });

  it('Method: startOfDay', () => {
    const expected = '2018-10-30T00:00:00.000Z';
    expect(adapter.startOfDay(testDateIso)).toEqualDateTime(expected);
    expect(adapter.startOfDay(testDateLocale)).toEqualDateTime(expected);
  });

  it('Method: startOfHour', () => {
    const expected = '2018-10-30T11:00:00.000Z';
    expect(adapter.startOfHour(testDateIso)).toEqualDateTime(expected);
  });

  it('Method: startOfMinute', () => {
    const expected = '2018-10-30T11:44:00.000Z';
    expect(adapter.startOfMinute(testDateIso)).toEqualDateTime(expected);
  });

  it('Method: startOfSecond', () => {
    const expected = '2018-10-30T11:44:25.000Z';
    expect(adapter.startOfSecond(testDateIso)).toEqualDateTime(expected);
  });

  it('Method: endOfYear', () => {
    const expected = '2018-12-31T23:59:59.999Z';
    expect(adapter.endOfYear(testDateIso)).toEqualDateTime(expected);
    expect(adapter.endOfYear(testDateLocale)).toEqualDateTime(expected);
  });

  describe('Method: endOfMonth', () => {
    it('should handle basic use-cases', () => {
      const expected = '2018-10-31T23:59:59.999Z';
      expect(adapter.endOfMonth(testDateIso)).toEqualDateTime(expected);
      expect(adapter.endOfMonth(testDateLocale)).toEqualDateTime(expected);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should update the offset when entering DST', () => {
      expectSameTimeInMonacoTZ(adapterTZ, testDateLastNonDSTDay);
      expectSameTimeInMonacoTZ(adapterTZ, adapterTZ.endOfMonth(testDateLastNonDSTDay));
    });
  });

  it('Method: endOfWeek', () => {
    expect(adapter.endOfWeek(testDateIso)).toEqualDateTime('2018-11-03T23:59:59.999Z');
    expect(adapter.endOfWeek(testDateLocale)).toEqualDateTime('2018-11-03T23:59:59.999Z');
  });

  it('Method: endOfDay', () => {
    const expected = '2018-10-30T23:59:59.999Z';
    expect(adapter.endOfDay(testDateIso)).toEqualDateTime(expected);
    expect(adapter.endOfDay(testDateLocale)).toEqualDateTime(expected);
  });

  it('Method: endOfHour', () => {
    const expected = '2018-10-30T11:59:59.999Z';
    expect(adapter.endOfHour(testDateIso)).toEqualDateTime(expected);
  });

  it('Method: endOfMinute', () => {
    const expected = '2018-10-30T11:44:59.999Z';
    expect(adapter.endOfMinute(testDateIso)).toEqualDateTime(expected);
  });

  it('Method: endOfSecond', () => {
    const expected = '2018-10-30T11:44:25.999Z';
    expect(adapter.endOfSecond(testDateIso)).toEqualDateTime(expected);
  });

  it('Method: addYears', () => {
    expect(adapter.addYears(testDateIso, 2)).toEqualDateTime('2020-10-30T11:44:25.750Z');
    expect(adapter.addYears(testDateIso, -2)).toEqualDateTime('2016-10-30T11:44:25.750Z');
  });

  describe('Method: addMonths', () => {
    it('should handle basic use-cases', () => {
      expect(adapter.addMonths(testDateIso, 2)).toEqualDateTime('2018-12-30T11:44:25.750Z');
      expect(adapter.addMonths(testDateIso, -2)).toEqualDateTime('2018-08-30T11:44:25.750Z');
      expect(adapter.addMonths(testDateIso, 3)).toEqualDateTime('2019-01-30T11:44:25.750Z');
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should update the offset when entering DST', () => {
      expectSameTimeInMonacoTZ(adapterTZ, testDateLastNonDSTDay);
      expectSameTimeInMonacoTZ(adapterTZ, adapterTZ.addMonths(testDateLastNonDSTDay, 1));
    });
  });

  describe('Method: addWeeks', () => {
    it('should handle basic use-cases', () => {
      expect(adapter.addWeeks(testDateIso, 2)).toEqualDateTime('2018-11-13T11:44:25.750Z');
      expect(adapter.addWeeks(testDateIso, -2)).toEqualDateTime('2018-10-16T11:44:25.750Z');
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should update the offset when entering DST', () => {
      expectSameTimeInMonacoTZ(adapterTZ, testDateLastNonDSTDay);
      expectSameTimeInMonacoTZ(adapterTZ, adapterTZ.addWeeks(testDateLastNonDSTDay, 1));
    });
  });

  describe('Method: addWeeks', () => {
    it('should handle basic use-cases', () => {
      expect(adapter.addDays(testDateIso, 2)).toEqualDateTime('2018-11-01T11:44:25.750Z');
      expect(adapter.addDays(testDateIso, -2)).toEqualDateTime('2018-10-28T11:44:25.750Z');
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should update the offset when entering DST', () => {
      expectSameTimeInMonacoTZ(adapterTZ, testDateLastNonDSTDay);
      expectSameTimeInMonacoTZ(adapterTZ, adapterTZ.addDays(testDateLastNonDSTDay, 1));
    });
  });

  it('Method: addHours', () => {
    expect(adapter.addHours(testDateIso, 2)).toEqualDateTime('2018-10-30T13:44:25.750Z');
    expect(adapter.addHours(testDateIso, -2)).toEqualDateTime('2018-10-30T09:44:25.750Z');
    expect(adapter.addHours(testDateIso, 15)).toEqualDateTime('2018-10-31T02:44:25.750Z');
  });

  it('Method: addMinutes', () => {
    expect(adapter.addMinutes(testDateIso, 2)).toEqualDateTime('2018-10-30T11:46:25.750Z');
    expect(adapter.addMinutes(testDateIso, -2)).toEqualDateTime('2018-10-30T11:42:25.750Z');
    expect(adapter.addMinutes(testDateIso, 20)).toEqualDateTime('2018-10-30T12:04:25.750Z');
  });

  it('Method: addSeconds', () => {
    expect(adapter.addSeconds(testDateIso, 2)).toEqualDateTime('2018-10-30T11:44:27.750Z');
    expect(adapter.addSeconds(testDateIso, -2)).toEqualDateTime('2018-10-30T11:44:23.750Z');
    expect(adapter.addSeconds(testDateIso, 70)).toEqualDateTime('2018-10-30T11:45:35.750Z');
  });

  it('Method: addMilliseconds', () => {
    expect(adapter.addMilliseconds(testDateIso, 2)).toEqualDateTime('2018-10-30T11:44:25.752Z');
    expect(adapter.addMilliseconds(testDateIso, -2)).toEqualDateTime('2018-10-30T11:44:25.748Z');
    expect(adapter.addMilliseconds(testDateIso, 500)).toEqualDateTime('2018-10-30T11:44:26.250Z');
  });

  it('Method: getYear', () => {
    expect(adapter.getYear(testDateIso)).toBe(2018);
  });

  it('Method: getMonth', () => {
    expect(adapter.getMonth(testDateIso)).toBe(9);
  });

  it('Method: getDate', () => {
    expect(adapter.getDate(testDateIso)).toBe(30);
  });

  it('Method: getHours', () => {
    expect(adapter.getHours(testDateIso)).toBe(11);
  });

  it('Method: getMinutes', () => {
    expect(adapter.getMinutes(testDateIso)).toBe(44);
  });

  it('Method: getSeconds', () => {
    expect(adapter.getSeconds(testDateIso)).toBe(25);
  });

  it('Method: getMilliseconds', () => {
    expect(adapter.getMilliseconds(testDateIso)).toBe(750);
  });

  it('Method: getTime', () => {
    expect(adapter.getTime(testDateIso)).toBe(1540899865750);
  });

  it('Method: setYear', () => {
    expect(adapter.setYear(testDateIso, 2011)).toEqualDateTime('2011-10-30T11:44:25.750');
  });

  it('Method: setMonth', () => {
    expect(adapter.setMonth(testDateIso, 4)).toEqualDateTime('2018-05-30T11:44:25.750');
  });

  it('Method: setDate', () => {
    expect(adapter.setDate(testDateIso, 15)).toEqualDateTime('2018-10-15T11:44:25.750');
  });

  it('Method: setHours', () => {
    expect(adapter.setHours(testDateIso, 0)).toEqualDateTime('2018-10-30T00:44:25.750');
  });

  it('Method: setMinutes', () => {
    expect(adapter.setMinutes(testDateIso, 12)).toEqualDateTime('2018-10-30T11:12:25.750');
  });

  it('Method: setSeconds', () => {
    expect(adapter.setSeconds(testDateIso, 11)).toEqualDateTime('2018-10-30T11:44:11.750');
  });

  it('Method: setMilliseconds', () => {
    expect(adapter.setMilliseconds(testDateIso, 11)).toEqualDateTime('2018-10-30T11:44:25.011Z');
  });

  describe('Method: differenceInYears', () => {
    it('should handle basic use-cases', () => {
      expect(
        adapter.differenceInYears(
          adapter.date('2020-04-01', 'default'),
          adapter.date('2018-10-30', 'default'),
        ),
      ).toBe(1);

      expect(
        adapter.differenceInYears(
          adapter.date('2020-04-01', 'default'),
          adapter.date('2018-04-01', 'default'),
        ),
      ).toBe(2);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with timezones', () => {
      expect(
        adapter.differenceInYears(
          adapter.date('2020-04-01T12:00', 'Europe/Paris'),
          adapter.date('2018-04-01T12:00', 'America/New_York'),
        ),
      ).toBe(1);
    });
  });

  describe('Method: differenceInMonths', () => {
    it('should handle basic use-cases', () => {
      expect(
        adapter.differenceInMonths(
          adapter.date('2019-01-30', 'default'),
          adapter.date('2018-10-30', 'default'),
        ),
      ).toBe(3);

      expect(
        adapter.differenceInMonths(
          adapter.date('2019-01-15', 'default'),
          adapter.date('2018-10-30', 'default'),
        ),
      ).toBe(2);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with timezones', () => {
      expect(
        adapter.differenceInMonths(
          adapter.date('2018-06-30T12:00', 'Europe/Paris'),
          adapter.date('2018-04-30T12:00', 'America/New_York'),
        ),
      ).toBe(1);
    });
  });

  describe('Method: differenceInDays', () => {
    it('should handle basic use-cases', () => {
      expect(
        adapter.differenceInDays(
          adapter.date('2018-11-05', 'default'),
          adapter.date('2018-10-30', 'default'),
        ),
      ).toBe(6);

      expect(
        adapter.differenceInDays(
          adapter.date('2018-11-05', 'default'),
          adapter.date('2018-11-01', 'default'),
        ),
      ).toBe(4);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with timezones', () => {
      expect(
        adapter.differenceInDays(
          adapter.date('2018-10-07T12:00', 'Europe/Paris'),
          adapter.date('2018-10-05T12:00', 'America/New_York'),
        ),
      ).toBe(1);
    });
  });

  describe('Method: differenceInHours', () => {
    it('should handle basic use-cases', () => {
      expect(
        adapter.differenceInHours(
          adapter.date('2018-10-31T15:00', 'default'),
          adapter.date('2018-10-30T11:00', 'default'),
        ),
      ).toBe(28);

      expect(
        adapter.differenceInHours(
          adapter.date('2018-10-31T15:00', 'default'),
          adapter.date('2018-10-31T11:00', 'default'),
        ),
      ).toBe(4);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with timezones', () => {
      expect(
        adapter.differenceInHours(
          adapter.date('2018-10-30T12:00', 'Europe/Paris'),
          adapter.date('2018-10-30T12:00', 'America/New_York'),
        ),
      ).toBe(-5);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work accross DST', () => {
      expect(
        adapter.differenceInHours(
          adapter.date('2022-03-28', 'Europe/Paris'),
          adapter.date('2022-03-27', 'Europe/Paris'),
        ),
      ).toBe(23);
    });
  });

  describe('Method: differenceInMinutes', () => {
    it('should handle basic use-cases', () => {
      expect(
        adapter.differenceInMinutes(
          adapter.date('2018-10-30T12:30', 'default'),
          adapter.date('2018-10-30T11:00', 'default'),
        ),
      ).toBe(90);

      expect(
        adapter.differenceInMinutes(
          adapter.date('2018-10-30T11:30', 'default'),
          adapter.date('2018-10-30T11:00', 'default'),
        ),
      ).toBe(30);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work with timezones', () => {
      expect(
        adapter.differenceInMinutes(
          adapter.date('2018-10-30T12:00', 'Europe/Paris'),
          adapter.date('2018-10-30T12:00', 'America/New_York'),
        ),
      ).toBe(-300);
    });

    test.skipIf(!adapter.isTimezoneCompatible)('should work accross DST', () => {
      expect(
        adapter.differenceInMinutes(
          adapter.date('2022-03-28', 'Europe/Paris'),
          adapter.date('2022-03-27', 'Europe/Paris'),
        ),
      ).toBe(23 * 60);
    });
  });

  it('Method: getDaysInMonth', () => {
    expect(adapter.getDaysInMonth(testDateIso)).toBe(31);
    expect(adapter.getDaysInMonth(testDateLocale)).toBe(31);
    expect(adapter.getDaysInMonth(adapter.addMonths(testDateIso, 1))).toBe(30);
  });

  it('Method: getDayOfWeek', () => {
    expect(adapter.getDayOfWeek(testDateIso)).toBe(3);
  });

  it('Method: getWeekNumber', () => {
    expect(adapter.getWeekNumber(testDateIso)).toBe(44);
  });
};
