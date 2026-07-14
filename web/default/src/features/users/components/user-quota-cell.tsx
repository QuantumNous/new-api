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

import { StatusBadge } from '@/components/status-badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Inline quota values longer than this switch to locale-aware compact
 * notation (e.g. "¥4.8万"); precise values stay available in the tooltip.
 */
const MAX_INLINE_QUOTA_CHARS = 8

type UserQuotaCellProps = {
  used: number
  remaining: number
}

function getQuotaProgressColor(percentage: number): string {
  if (percentage <= 10) {
    return '[&_[data-slot=progress-indicator]]:bg-destructive'
  }
  if (percentage <= 30) {
    return '[&_[data-slot=progress-indicator]]:bg-warning'
  }
  return '[&_[data-slot=progress-indicator]]:bg-success'
}

export function UserQuotaCell(props: UserQuotaCellProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const total = props.used + props.remaining
  const percentage = total > 0 ? (props.remaining / total) * 100 : 0

  if (total === 0) {
    return <StatusBadge variant='neutral'>{t('No Quota')}</StatusBadge>
  }

  const toInlineQuota = (value: number) => {
    const full = formatQuota(value)
    if (full.length <= MAX_INLINE_QUOTA_CHARS) {
      return full
    }
    return formatQuotaWithCurrency(value, { compact: true, locale })
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<div className='w-full cursor-help space-y-1 sm:w-[150px]' />}
      >
        <div className='flex justify-between gap-2 text-xs'>
          <span className='truncate font-medium tabular-nums'>
            {toInlineQuota(props.remaining)}
          </span>
          <span className='text-muted-foreground truncate tabular-nums'>
            {toInlineQuota(total)}
          </span>
        </div>
        <Progress
          value={percentage}
          className={cn('h-1.5', getQuotaProgressColor(percentage))}
        />
      </TooltipTrigger>
      <TooltipContent>
        <div className='space-y-1 text-xs'>
          <div>
            {t('Used:')} {formatQuota(props.used)}
          </div>
          <div>
            {t('Remaining:')} {formatQuota(props.remaining)}
          </div>
          <div>
            {t('Total:')} {formatQuota(total)}
          </div>
          <div>
            {t('Percentage:')} {percentage.toFixed(1)}%
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
