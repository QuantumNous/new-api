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
// A string that is nothing but a number literal — optional sign, digits, an
// optional fraction and an optional exponent. Such a string carries no date
// punctuation, so it must never be handed to Date.parse, which would guess a
// calendar year from it.
const BARE_NUMERIC_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
// Of those, only a plain unsigned run of digits is accepted as a timestamp.
// A sign, a fraction, a trailing dot or exponent notation is not a form any
// timestamp field produces, so it is rejected rather than coerced into a
// number that merely happens to be exact.
const BARE_DIGITS_RE = /^\d+$/;
// The non-finite numeric literals.  BARE_NUMERIC_RE cannot match them because
// they contain no digits, so they need their own check to stay out of
// Date.parse.  The match is case-insensitive and covers an optional sign:
// JavaScript itself only accepts the exact-case `NaN`, `Infinity`, `+Infinity`
// and `-Infinity` as literals, but no casing of these words is ever a date, so
// every casing is refused here instead of being left to Date.parse's
// engine-defined behaviour for unrecognised input.
const NON_FINITE_LITERAL_RE = /^[+-]?(?:nan|infinity)$/i;

/**
 * The single rule for a numeric bound, shared by number values and by bare
 * numeric strings.
 *
 * A bound must already be exact: a positive safe integer. Rounding a fraction
 * here would manufacture a valid-looking whole second out of an invalid input
 * and slip it past the strict range validator, so a fraction, NaN, Infinity,
 * an unsafe integer or a non-positive value is rejected rather than repaired.
 *
 * Values above NUMERIC_MILLISECOND_THRESHOLD are whole milliseconds and are
 * truncated to seconds; that is Date.getTime()'s documented unit, not a repair.
 */
const parseNumericTimestamp = (value) => {
  if (!Number.isSafeInteger(value) || value <= 0) return Number.NaN;
  if (value > NUMERIC_MILLISECOND_THRESHOLD) {
    return Math.floor(value / 1000);
  }
  return value;
};
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
    return parseNumericTimestamp(value);
  }

  const text = String(value ?? '').trim();

  // A bare numeric string must go through the same numeric rule, never through
  // Date.parse.  Date.parse guesses a year from a bare number: '0' becomes
  // 2000-01-01, '-1' becomes 2001-01-01 and '1.5' becomes 2001-01-05, all of
  // which are valid-looking instants produced from an invalid bound.
  if (BARE_NUMERIC_RE.test(text)) {
    if (!BARE_DIGITS_RE.test(text)) return Number.NaN;
    return parseNumericTimestamp(Number(text));
  }

  // A non-finite numeric literal is a number that is not a bound, so it is
  // rejected here rather than handed to Date.parse.
  if (NON_FINITE_LITERAL_RE.test(text)) {
    return Number.NaN;
  }

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
