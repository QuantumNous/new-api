import type { TFunction } from 'i18next'
import dayjs from '@/lib/dayjs'
import type { SubscriptionPlan } from '../types'

export function formatDuration(plan: Partial<SubscriptionPlan>, t: TFunction): string {
  const unit = plan?.duration_unit || 'month'
  const value = plan?.duration_value || 1
  const unitLabels: Record<string, string> = {
    year: t('年'),
    month: t('个月'),
    day: t('天'),
    hour: t('小时'),
    custom: t('自定义'),
  }
  if (unit === 'custom') {
    const seconds = plan?.custom_seconds || 0
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('天')}`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('小时')}`
    return `${seconds} ${t('秒')}`
  }
  return `${value} ${unitLabels[unit] || unit}`
}

export function formatResetPeriod(plan: Partial<SubscriptionPlan>, t: TFunction): string {
  const period = plan?.quota_reset_period || 'never'
  if (period === 'daily') return t('每天')
  if (period === 'weekly') return t('每周')
  if (period === 'monthly') return t('每月')
  if (period === 'custom') {
    const seconds = Number(plan?.quota_reset_custom_seconds || 0)
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('天')}`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('小时')}`
    if (seconds >= 60) return `${Math.floor(seconds / 60)} ${t('分钟')}`
    return `${seconds} ${t('秒')}`
  }
  return t('不重置')
}

export function formatTimestamp(ts: number): string {
  if (!ts) return '-'
  return dayjs(ts * 1000).format('YYYY-MM-DD HH:mm:ss')
}
