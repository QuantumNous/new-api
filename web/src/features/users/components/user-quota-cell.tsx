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

import { QuotaDetailsPopover } from '@/components/quota-details-popover'
import { StatusBadge } from '@/components/status-badge'
import { Progress } from '@/components/ui/progress'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency, getCurrencyDisplay } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

type UserQuotaCellProps = {
  remaining: number
  used: number
}

export function UserQuotaCell(props: UserQuotaCellProps) {
  const { t, i18n } = useTranslation()
  useSystemConfigStore((state) => state.config.currency)

  const { meta: currency } = getCurrencyDisplay()
  const quotaUnit = currency.kind === 'tokens' ? t('Tokens') : currency.symbol
  const hasQuota = props.remaining !== 0 || props.used !== 0
  const total = props.used + props.remaining
  const hasProgress = total > 0
  const percentage = hasProgress
    ? Math.min(100, Math.max(0, (props.remaining / total) * 100))
    : 0
  const formattedRemaining = formatQuotaWithCurrency(props.remaining, {
    showSymbol: false,
  })
  const formattedUsed = formatQuotaWithCurrency(props.used, {
    showSymbol: false,
  })
  const formattedTotal = formatQuotaWithCurrency(total, { showSymbol: false })
  const formattedPercentage = new Intl.NumberFormat(
    toIntlLocale(i18n.resolvedLanguage || i18n.language),
    { maximumFractionDigits: 1 }
  ).format(percentage)
  let progressColor = 'text-emerald-500'
  if (props.remaining <= 0) progressColor = 'text-rose-500'
  else if (percentage <= 10) progressColor = 'text-rose-500'
  else if (percentage <= 30) progressColor = 'text-amber-500'

  const details = [
    { label: t('Available Balance'), value: formattedRemaining },
    { label: t('Total Used'), value: formattedUsed },
    { label: t('Current total quota'), value: formattedTotal },
  ]
  if (hasProgress) {
    details.push({
      label: t('Remaining percentage'),
      value: `${formattedPercentage}%`,
    })
  }

  return (
    <QuotaDetailsPopover
      title={`${t('Quota')} (${quotaUnit})`}
      triggerLabel={
        hasQuota
          ? `${t('Available Balance')} ${formattedRemaining}; ${t('Total Used')} ${formattedUsed}; ${t('Current total quota')} ${formattedTotal}`
          : t('No Quota')
      }
      details={details}
      className={cn('space-y-1.5', !hasQuota && 'min-h-11')}
      triggerClassName={!hasQuota ? 'min-h-11 h-full' : undefined}
      afterTrigger={
        hasProgress && (
          <Progress
            value={percentage}
            aria-label={t('Remaining percentage')}
            className={cn(
              'w-full [&_[data-slot=progress-indicator]]:bg-current',
              progressColor
            )}
          />
        )
      }
    >
      {hasQuota ? (
        <span className='grid w-full min-w-0 grid-cols-2 gap-x-4 text-sm tabular-nums'>
          <span
            className={cn(
              'min-w-0 truncate font-medium',
              props.remaining < 0 && 'text-destructive',
              props.remaining === 0 && 'text-muted-foreground'
            )}
          >
            {formattedRemaining}
          </span>
          <span className='text-muted-foreground min-w-0 truncate text-right'>
            {formattedTotal}
          </span>
        </span>
      ) : (
        <StatusBadge
          label={t('No Quota')}
          variant='neutral'
          copyable={false}
          className='bg-muted/50 -ml-1.5 h-full min-h-11 w-full justify-start rounded-4xl px-3 font-normal'
        />
      )}
    </QuotaDetailsPopover>
  )
}
