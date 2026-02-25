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
export function formatSubscriptionDuration(plan, t) {
  const unit = plan?.duration_unit || 'month';
  const value = plan?.duration_value || 1;
  const unitLabels = {
    year: t('年'),
    month: t('个月'),
    day: t('天'),
    hour: t('小时'),
    custom: t('自定义'),
  };
  if (unit === 'custom') {
    const seconds = plan?.custom_seconds || 0;
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('天')}`;
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('小时')}`;
    return `${seconds} ${t('秒')}`;
  }
  return `${value} ${unitLabels[unit] || unit}`;
}

export function formatSubscriptionResetPeriodShort(plan, t) {
  const period = plan?.quota_reset_period || 'never';
  if (period === 'daily') return `/${t('天')}`;
  if (period === 'weekly') return `/${t('周')}`;
  if (period === 'monthly') return `/${t('月')}`;
  if (period === 'custom') {
    const seconds = Number(plan?.quota_reset_custom_seconds || 0);
    if (seconds >= 86400) return `/${Math.floor(seconds / 86400)}${t('天')}`;
    if (seconds >= 3600) return `/${Math.floor(seconds / 3600)}${t('小时')}`;
    if (seconds >= 60) return `/${Math.floor(seconds / 60)}${t('分钟')}`;
    return `/${seconds}${t('秒')}`;
  }
  return '';
}

export function getResetPeriodsCount(plan) {
  const period = plan?.quota_reset_period || 'never';
  if (period === 'never') return 0;

  // duration in seconds
  const durationUnit = plan?.duration_unit || 'month';
  const durationValue = plan?.duration_value || 1;
  let durationSeconds;
  switch (durationUnit) {
    case 'year':
      durationSeconds = durationValue * 365.25 * 86400;
      break;
    case 'month':
      durationSeconds = durationValue * 30.44 * 86400;
      break;
    case 'day':
      durationSeconds = durationValue * 86400;
      break;
    case 'hour':
      durationSeconds = durationValue * 3600;
      break;
    case 'custom':
      durationSeconds = plan?.custom_seconds || 0;
      break;
    default:
      return 0;
  }

  // reset period in seconds
  let resetSeconds;
  switch (period) {
    case 'daily':
      resetSeconds = 86400;
      break;
    case 'weekly':
      resetSeconds = 7 * 86400;
      break;
    case 'monthly':
      resetSeconds = 30.44 * 86400;
      break;
    case 'custom':
      resetSeconds = Number(plan?.quota_reset_custom_seconds || 0);
      break;
    default:
      return 0;
  }

  if (resetSeconds <= 0 || durationSeconds <= 0) return 0;
  return Math.floor(durationSeconds / resetSeconds);
}

export function formatSubscriptionResetPeriod(plan, t) {
  const period = plan?.quota_reset_period || 'never';
  if (period === 'never') return t('不重置');
  if (period === 'daily') return t('每天');
  if (period === 'weekly') return t('每周');
  if (period === 'monthly') return t('每月');
  if (period === 'custom') {
    const seconds = Number(plan?.quota_reset_custom_seconds || 0);
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('天')}`;
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('小时')}`;
    if (seconds >= 60) return `${Math.floor(seconds / 60)} ${t('分钟')}`;
    return `${seconds} ${t('秒')}`;
  }
  return t('不重置');
}
