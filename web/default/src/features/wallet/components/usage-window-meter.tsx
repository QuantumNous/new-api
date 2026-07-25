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
import { useTranslation } from 'react-i18next'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { Progress } from '@/components/ui/progress'
import type { SubscriptionUsageWindow } from '@/features/subscriptions/types'

type UsageWindowMeterProps = {
  label: string
  window: SubscriptionUsageWindow | undefined
  secondary?: boolean
  media?: boolean
}

function clampPercent(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)))
}

function formatUsageValue(value: number, media: boolean): string {
  if (media) return String(Math.max(0, Math.round(value)))
  return formatQuota(value)
}

export function UsageWindowMeter(props: UsageWindowMeterProps) {
  const { t } = useTranslation()
  const used = Number(props.window?.used ?? 0)
  const total = Number(props.window?.total ?? 0)
  const remaining = Number(props.window?.remaining ?? Math.max(0, total - used))
  const percent = clampPercent(used, total)
  const unlimited =
    props.window?.unlimited === true || (props.media !== true && total <= 0)
  const notIncluded = props.media === true && !unlimited && total <= 0
  const resetAt = Number(props.window?.reset_at ?? 0)

  return (
    <div
      className='space-y-1.5'
      data-wallet-usage-meter={props.label}
      data-wallet-secondary-meter={props.secondary ? props.label : undefined}
    >
      <div className='flex min-h-5 items-center justify-between gap-3 text-xs'>
        <span className='font-medium'>{props.label}</span>
        <span className='text-muted-foreground tabular-nums'>
          {unlimited
            ? t('Unlimited')
            : notIncluded
              ? t('Not included')
              : t('{{used}} / {{total}} used', {
                  used: formatUsageValue(used, props.media === true),
                  total: formatUsageValue(total, props.media === true),
                })}
        </span>
      </div>
      <Progress value={percent} className='h-1.5' />
      <div className='text-muted-foreground min-h-4 text-xs'>
        {unlimited
          ? t('No usage limit')
          : notIncluded
            ? t('0 remaining')
            : resetAt > 0
              ? t('{{remaining}} remaining, resets {{date}}', {
                  remaining: formatUsageValue(remaining, props.media === true),
                  date: formatTimestampToDate(resetAt),
                })
              : t('{{remaining}} remaining', {
                  remaining: formatUsageValue(remaining, props.media === true),
                })}
      </div>
    </div>
  )
}
