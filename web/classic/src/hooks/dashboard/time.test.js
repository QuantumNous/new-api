import { expect, test } from 'bun:test';
import { parseDashboardDateRange, parseDashboardTimestamp } from './time';

test('Classic dashboard wall-clock strings always use Asia/Shanghai', () => {
  expect(parseDashboardTimestamp('2024-01-01 00:00:00')).toBe(1704038400);
  expect(parseDashboardTimestamp('2024-01-01T08:00:00')).toBe(1704067200);
});

test('DatePicker Date values use their selected wall-clock components', () => {
  const selected = new Date(2024, 0, 1, 0, 0, 0);
  expect(parseDashboardTimestamp(selected)).toBe(1704038400);
});

test('explicit-offset values remain instants and ranges are numeric seconds', () => {
  const range = parseDashboardDateRange(
    '2024-01-01T00:00:00+08:00',
    '2024-01-01T01:00:00+08:00',
  );
  expect(range).toEqual({ start: 1704038400, end: 1704042000 });
});
