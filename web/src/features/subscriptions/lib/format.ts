/*
Copyright (C) 2023-2026 QuantumNous

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
import type { TFunction } from 'i18next'

import { formatDisplayDate, formatFixed } from '@/lib/format'

import type { SubscriptionPlan } from '../types'

/** Pass the interface locale (toIntlLocale) so the number uses its digits. */
export function formatDuration(
  plan: Partial<SubscriptionPlan>,
  t: TFunction,
  locale?: Intl.LocalesArgument
): string {
  const count = (value: number) => formatFixed(value, 0, locale)
  const unit = plan?.duration_unit || 'month'
  const value = plan?.duration_value || 1
  const unitLabels: Record<string, string> = {
    year: t('years'),
    month: t('months'),
    day: t('days'),
    hour: t('hours'),
    custom: t('Custom (seconds)'),
  }
  if (unit === 'custom') {
    const seconds = plan?.custom_seconds || 0
    if (seconds >= 86400) {
      return `${count(Math.floor(seconds / 86400))} ${t('days')}`
    }
    if (seconds >= 3600) {
      return `${count(Math.floor(seconds / 3600))} ${t('hours')}`
    }
    return `${count(seconds)} ${t('seconds')}`
  }
  return `${count(value)} ${unitLabels[unit] || unit}`
}

/** Pass the interface locale (toIntlLocale) so the number uses its digits. */
export function formatResetPeriod(
  plan: Partial<SubscriptionPlan>,
  t: TFunction,
  locale?: Intl.LocalesArgument
): string {
  const count = (value: number) => formatFixed(value, 0, locale)
  const period = plan?.quota_reset_period || 'never'
  if (period === 'daily') return t('Daily')
  if (period === 'weekly') return t('Weekly')
  if (period === 'monthly') return t('Monthly')
  if (period === 'custom') {
    const seconds = Number(plan?.quota_reset_custom_seconds || 0)
    if (seconds >= 86400) {
      return `${count(Math.floor(seconds / 86400))} ${t('days')}`
    }
    if (seconds >= 3600) {
      return `${count(Math.floor(seconds / 3600))} ${t('hours')}`
    }
    if (seconds >= 60) {
      return `${count(Math.floor(seconds / 60))} ${t('minutes')}`
    }
    return `${count(seconds)} ${t('seconds')}`
  }
  return t('No Reset')
}

/** Solar Hijri for a Persian locale from `toIntlLocale`, see `formatDisplayDate` */
export function formatTimestamp(ts: number, locale?: string): string {
  if (!ts) return '-'
  return formatDisplayDate(ts * 1000, 'YYYY-MM-DD HH:mm:ss', locale)
}
