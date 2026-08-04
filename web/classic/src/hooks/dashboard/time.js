// Dashboard date inputs are displayed as wall-clock values.  Treat those
// values as Asia/Shanghai explicitly instead of relying on Date.parse's
// browser-local interpretation (which differs on non-CST machines).
const CST_OFFSET_SECONDS = 8 * 60 * 60;
const LOCAL_DATE_TIME_RE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

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
    // Semi UI's DatePicker supplies a Date whose local components represent
    // the selected wall-clock value.  Read components, then attach CST.
    return toCstEpochSeconds(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      value.getMilliseconds(),
    );
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return Number.NaN;
    // Numeric dashboard values are Unix seconds in the existing state shape;
    // accept millisecond values as a defensive compatibility measure.
    return Math.floor(Math.abs(value) > 1e11 ? value / 1000 : value);
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
