import { expect, test } from 'bun:test';
import { parseDashboardDateRange, parseDashboardTimestamp } from './time';

test('Classic dashboard wall-clock strings always use Asia/Shanghai', () => {
  expect(parseDashboardTimestamp('2024-01-01 00:00:00')).toBe(1704038400);
  expect(parseDashboardTimestamp('2024-01-01T08:00:00')).toBe(1704067200);
});

test('Date values are converted through fixed Asia/Shanghai across DST gaps', () => {
  // The -05:00 wall-clock value falls in the America/New_York spring-forward
  // gap.  Parsing the Date as an instant must remain stable regardless of the
  // browser TZ; local getHours() would reinterpret it after normalization.
  const selected = new Date('2024-03-10T02:30:00-05:00');
  expect(parseDashboardTimestamp(selected)).toBe(
    Math.floor(selected.getTime() / 1000),
  );
});

test('explicit-offset values remain instants and ranges are numeric seconds', () => {
  const range = parseDashboardDateRange(
    '2024-01-01T00:00:00+08:00',
    '2024-01-01T01:00:00+08:00',
  );
  expect(range).toEqual({ start: 1704038400, end: 1704042000 });
});
