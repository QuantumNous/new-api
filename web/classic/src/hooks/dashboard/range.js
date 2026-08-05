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

// Dashboard time-range policy, mirroring common/dashboard_range.go.
//
// The server accepts a span of up to DASHBOARD_MAX_RANGE_DAYS and internally
// splits anything longer than DASHBOARD_MAX_SEGMENT_DAYS into bounded segments
// that it merges again over Asia/Shanghai buckets. The client enforces the same
// total bound so an impossible selection fails immediately with an actionable
// message instead of a round trip that can only be rejected.
export const DASHBOARD_MAX_RANGE_DAYS = 90;
export const DASHBOARD_MAX_SEGMENT_DAYS = 31;
export const DASHBOARD_MAX_RANGE_SECONDS =
  DASHBOARD_MAX_RANGE_DAYS * 24 * 60 * 60;

export const DASHBOARD_RANGE_INVALID = 'dashboard_range_invalid';
export const DASHBOARD_RANGE_INVERTED = 'dashboard_range_inverted';
export const DASHBOARD_RANGE_TOO_LARGE = 'dashboard_range_too_large';

/**
 * Returns an error code for an unusable range, or an empty string when the
 * range can be served. Accepts the already-parsed CST epoch seconds.
 */
export const validateDashboardRange = (start, end) => {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return DASHBOARD_RANGE_INVALID;
  }
  if (start < 0 || end < 0) return DASHBOARD_RANGE_INVALID;
  if (end < start) return DASHBOARD_RANGE_INVERTED;
  if (end - start > DASHBOARD_MAX_RANGE_SECONDS) {
    return DASHBOARD_RANGE_TOO_LARGE;
  }
  return '';
};

export const describeDashboardRangeError = (code, t) => {
  const translate = typeof t === 'function' ? t : (value) => value;
  switch (code) {
    case DASHBOARD_RANGE_TOO_LARGE:
      return `${translate('查询时间跨度不能超过')} ${DASHBOARD_MAX_RANGE_DAYS} ${translate('天')}`;
    case DASHBOARD_RANGE_INVERTED:
      return translate('结束时间不能早于开始时间');
    case DASHBOARD_RANGE_INVALID:
      return translate('请选择有效的分析时间范围');
    default:
      return '';
  }
};
