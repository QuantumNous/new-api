/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// Dashboard date inputs are displayed as wall-clock values.  Treat those
// values as Asia/Shanghai explicitly instead of relying on Date.parse's
// browser-local interpretation (which differs on non-CST machines).
const CST_OFFSET_SECONDS = 8 * 60 * 60;
// Numbers above this are read as milliseconds, below it as seconds. 1e11
// seconds is year 5138, and 1e11 milliseconds is 1973, so no realistic bound is
// ambiguous.
const NUMERIC_MILLISECOND_THRESHOLD = 1e11;
const LOCAL_DATE_TIME_RE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;
const CST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  hour12: false,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const toCstEpochSeconds = (
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) => {
  const epochMilliseconds = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  return Math.floor(epochMilliseconds / 1000) - CST_OFFSET_SECONDS;
};

export const parseDashboardTimestamp = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return Number.NaN;
    // A Date is an instant.  Convert its components through a fixed
    // Asia/Shanghai formatter instead of getHours()/getDate(), whose local
    // timezone can normalize a DST gap (for example America/New_York).
    const parts = Object.fromEntries(
      CST_DATE_TIME_FORMATTER.formatToParts(value).map(
        ({ type, value: part }) => [type, part],
      ),
    );
    return toCstEpochSeconds(
      Number(parts.year),
      Number(parts.month),
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
  }

  if (typeof value === 'number') {
    // A numeric bound must already be an exact whole second (or an exact whole
    // millisecond).  Rounding a fractional number here would manufacture a
    // valid-looking second out of an invalid input and slip it past the strict
    // range validator, so a fraction is rejected rather than floored.
    if (!Number.isSafeInteger(value) || value <= 0) return Number.NaN;
    if (value > NUMERIC_MILLISECOND_THRESHOLD) {
      // Millisecond values are accepted for compatibility with Date.getTime().
      // Truncating to whole seconds is the documented meaning of that unit, not
      // a repair of a malformed value.
      return Math.floor(value / 1000);
    }
    return value;
  }

  const text = String(value ?? '').trim();
  const match = LOCAL_DATE_TIME_RE.exec(text);
  if (match) {
    const [, year, month, day, hour, minute, second, millisecond] = match;
    return toCstEpochSeconds(
      Number(year),
      Number(month),
      Number(day),
      Number(hour || 0),
      Number(minute || 0),
      Number(second || 0),
      Number((millisecond || '').padEnd(3, '0') || 0),
    );
  }

  // Preserve support for explicit-offset/ISO values.  Those carry their own
  // timezone and therefore must be parsed as instants, not reinterpreted CST.
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : Number.NaN;
};

export const parseDashboardDateRange = (start, end) => ({
  start: parseDashboardTimestamp(start),
  end: parseDashboardTimestamp(end),
});
