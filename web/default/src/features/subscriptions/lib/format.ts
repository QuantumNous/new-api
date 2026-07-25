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
import dayjs from '@/lib/dayjs'
import { formatQuota } from '@/lib/format'
import type { SubscriptionPlan } from '../types'

export function formatDuration(
  plan: Partial<SubscriptionPlan>,
  t: TFunction
): string {
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
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('days')}`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('hours')}`
    return `${seconds} ${t('seconds')}`
  }
  return `${value} ${unitLabels[unit] || unit}`
}

export function formatResetPeriod(
  plan: Partial<SubscriptionPlan>,
  t: TFunction
): string {
  const period = plan?.quota_reset_period || 'never'
  if (period === 'daily') return t('Daily')
  if (period === 'weekly') return t('Weekly')
  if (period === 'monthly') return t('Monthly')
  if (period === 'custom') {
    const seconds = Number(plan?.quota_reset_custom_seconds || 0)
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('days')}`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('hours')}`
    if (seconds >= 60) return `${Math.floor(seconds / 60)} ${t('minutes')}`
    return `${seconds} ${t('seconds')}`
  }
  return t('No Reset')
}

export function formatTimestamp(ts: number): string {
  if (!ts) return '-'
  return dayjs(ts * 1000).format('YYYY-MM-DD HH:mm:ss')
}

// 套餐可用模型数量文案：0 = 回退为「全部模型」
export function formatModelCount(
  plan: Partial<SubscriptionPlan>,
  t: TFunction
): string {
  const count = Number(plan?.model_count || 0)
  if (count > 0) return t('{{count}} models', { count })
  return t('All models')
}

// 套餐并发规格；RPM 不再作为套餐差异或限制展示。
export function formatSpeedSpecs(
  plan: Partial<SubscriptionPlan>,
  t: TFunction
): string[] {
  const specs: string[] = []
  const concurrency = Number(plan?.concurrency || 0)
  if (concurrency > 0)
    specs.push(t('{{count}} concurrent', { count: concurrency }))
  return specs
}

// 三层用量窗口摘要（加权美元），未配置的窗口省略
export function formatWindowSummary(
  plan: Partial<SubscriptionPlan>,
  t: TFunction
): string {
  const parts: string[] = []
  const w5h = Number(plan?.window_5h_amount || 0)
  const wWeek = Number(plan?.window_week_amount || 0)
  if (w5h > 0) parts.push(`${formatQuota(w5h)}/5h`)
  if (wWeek > 0) parts.push(`${formatQuota(wWeek)}/${t('week')}`)
  return parts.join(' · ')
}

// admin 录入的价值卖点：按换行拆分、去空行
export function parseFeatureLines(plan: Partial<SubscriptionPlan>): string[] {
  const raw = plan?.feature_lines || ''
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// 300 credits ≈ 100 images / 75s standard video — anchored on the standard
// tier of the public media price table (image 3 credits, video 4 credits/s).
const IMAGE_CREDITS_PER_UNIT = 3
const VIDEO_CREDITS_PER_SECOND = 4

export function formatMediaValue(credits: number, t: TFunction): string {
  let images = Math.floor(credits / IMAGE_CREDITS_PER_UNIT)
  if (images >= 200) {
    images = Math.floor(images / 100) * 100
  }
  const seconds = Math.floor(credits / VIDEO_CREDITS_PER_SECOND)
  if (seconds >= 120) {
    return t('≈ {{images}} images or {{minutes}} min of video', {
      images,
      minutes: Math.floor(seconds / 60),
    })
  }
  return t('≈ {{images}} images or {{seconds}}s of video', {
    images,
    seconds,
  })
}
