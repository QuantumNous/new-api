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

export const subscriptionWindowLimitDefinitions = [
  {
    key: '5h',
    field: 'window_limit_5h',
    getLabel: (t) => t('5小时'),
    getQuotaLabel: (t) => t('5小时额度'),
    getFormLabel: (t) => t('5小时窗口($)'),
  },
  {
    key: '24h',
    field: 'window_limit_24h',
    getLabel: (t) => t('24小时'),
    getQuotaLabel: (t) => t('24小时额度'),
    getFormLabel: (t) => t('24小时窗口($)'),
  },
  {
    key: '7d',
    field: 'window_limit_7d',
    getLabel: (t) => t('7日'),
    getQuotaLabel: (t) => t('本周额度'),
    getFormLabel: (t) => t('7天窗口($)'),
  },
  {
    key: '30d',
    field: 'window_limit_30d',
    getLabel: (t) => t('30天'),
    getQuotaLabel: (t) => t('本月额度'),
    getFormLabel: (t) => t('30天窗口($)'),
  },
];

const windowLabelGetters = {
  label: (item) => item.getLabel,
  quota: (item) => item.getQuotaLabel,
  form: (item) => item.getFormLabel,
};

export function getSubscriptionWindowLimitItems(plan, t, labelType = 'label') {
  return subscriptionWindowLimitDefinitions
    .map((item) => ({
      ...item,
      label: (windowLabelGetters[labelType]?.(item) || item.getLabel)(t),
      value: Number(plan?.[item.field] || 0),
    }))
    .filter((item) => item.value > 0);
}

export function hasSubscriptionWindowLimit(plan) {
  return subscriptionWindowLimitDefinitions.some(
    (item) => Number(plan?.[item.field] || 0) > 0,
  );
}
