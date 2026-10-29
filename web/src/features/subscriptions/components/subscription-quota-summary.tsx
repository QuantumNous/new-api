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
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge, StatusBadgeList } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuota } from '@/lib/format'

import { getPeriodQuotaOptions } from '../constants'
import type { SubscriptionPlan, SubscriptionQuotaWindows } from '../types'

type QuotaUsage = {
  limit: number
  used: number
  reset_at?: number
}

type Props = {
  plan?: Partial<SubscriptionPlan>
  windows?: SubscriptionQuotaWindows
  total?: QuotaUsage
  variant?: 'table'
}

export function SubscriptionQuotaSummary(props: Props) {
  const { t, i18n } = useTranslation()
  const options = getPeriodQuotaOptions(t)

  if (props.variant === 'table' && !props.windows && !props.total) {
    const hasLimits = options.some(
      (option) => (props.plan?.[option.field] ?? 0) > 0
    )
    if (!hasLimits) {
      return <span className='text-muted-foreground'>{t('Unlimited')}</span>
    }
    return (
      <StatusBadgeList
        role='group'
        aria-label={t('Subscription period quotas')}
        className='flex-col items-start gap-1 sm:grid sm:w-full sm:grid-cols-3 sm:gap-x-4'
        max={3}
        items={[...options]}
        getKey={(option) => option.key}
        renderItem={(option) => {
          const limit = props.plan?.[option.field] ?? 0
          const amount = limit > 0 ? formatQuota(limit) : t('Unlimited')
          const label = `${option.shortLabel} ${amount}`
          return (
            <StatusBadge
              label={label}
              className='h-auto shrink-0 text-[11px] whitespace-normal sm:flex-col sm:items-start sm:gap-1 sm:p-0 sm:text-sm'
              variant={
                ({ daily: 'info', weekly: 'purple', monthly: 'cyan' } as const)[
                  option.key
                ]
              }
              copyable={false}
            >
              <span
                data-table-text='secondary'
                className='sm:text-muted-foreground sm:text-xs sm:font-normal'
              >
                {option.shortLabel}
              </span>{' '}
              <span className='break-words whitespace-normal tabular-nums'>
                {amount}
              </span>
            </StatusBadge>
          )
        }}
      />
    )
  }

  // Plan limits are already complete information, including in table cells.
  if (!props.windows && !props.total) {
    return (
      <dl className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs'>
        {options.map((option) => {
          const limit = props.plan?.[option.field] ?? 0
          return (
            <div key={option.key} className='contents'>
              <dt data-table-text='secondary' className='text-muted-foreground'>
                {option.label}
              </dt>
              <dd className='text-right break-words tabular-nums'>
                {limit > 0 ? formatQuota(limit) : t('Unlimited')}
              </dd>
            </div>
          )
        })}
      </dl>
    )
  }

  const entries: Array<{ key: string; label: string; usage: QuotaUsage }> = []
  if (props.total) {
    entries.push({ key: 'total', label: t('Total Quota'), usage: props.total })
  }
  for (const option of options) {
    const usage = props.windows?.[option.key]
    if (usage) entries.push({ key: option.key, label: option.label, usage })
  }

  const formatter = new Intl.DateTimeFormat(
    toIntlLocale(i18n.resolvedLanguage || i18n.language),
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Shanghai',
    }
  )

  return (
    <div className='min-w-0 space-y-2.5'>
      {entries.map((entry) => {
        const usage = entry.usage
        const limit =
          usage.limit > 0 ? formatQuota(usage.limit) : t('Unlimited')
        const value = `${formatQuota(usage.used)} / ${limit}`
        return (
          <Collapsible
            key={entry.key}
            role='group'
            aria-label={entry.label}
            className='min-w-0 space-y-1'
          >
            <CollapsibleTrigger
              aria-label={`${entry.label}: ${value}`}
              render={
                <Button
                  variant='ghost'
                  className='group h-auto w-full min-w-0 justify-between gap-2 rounded-sm px-0 py-0.5 text-xs font-normal whitespace-normal hover:bg-transparent'
                />
              }
            >
              <span className='text-muted-foreground text-left'>
                {entry.label}
              </span>
              <span className='flex min-w-0 items-center gap-1'>
                <span className='text-right break-words tabular-nums'>
                  {value}
                </span>
                <ChevronDown
                  aria-hidden='true'
                  className='text-muted-foreground size-3 shrink-0 transition-transform group-aria-expanded:rotate-180'
                />
              </span>
            </CollapsibleTrigger>
            {usage.limit > 0 && (
              <Progress
                aria-label={entry.label}
                value={Math.min(
                  Math.max((usage.used / usage.limit) * 100, 0),
                  100
                )}
              />
            )}
            <CollapsibleContent>
              <dl className='text-muted-foreground grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 pt-1 text-xs'>
                <dt>{t('Remaining')}</dt>
                <dd className='text-right tabular-nums'>
                  {usage.limit > 0
                    ? formatQuota(Math.max(usage.limit - usage.used, 0))
                    : t('Unlimited')}
                </dd>
                {usage.reset_at !== undefined && usage.reset_at > 0 && (
                  <>
                    <dt>{t('Next reset')}</dt>
                    <dd className='text-right'>
                      <time
                        className='block tabular-nums'
                        dateTime={new Date(usage.reset_at * 1000).toISOString()}
                      >
                        {formatter.format(new Date(usage.reset_at * 1000))}
                      </time>
                    </dd>
                  </>
                )}
              </dl>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
