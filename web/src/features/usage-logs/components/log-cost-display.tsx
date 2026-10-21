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
import {
  CrownIcon,
  Wallet01Icon,
  Wrench01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatEasySavingsCny } from '@/features/dashboard/components/overview/easy-savings'
import { useStatus } from '@/hooks/use-status'
import { toIntlLocale } from '@/i18n/languages'
import { formatLogQuota } from '@/lib/format'
import { useSystemConfigStore } from '@/stores/system-config-store'

import {
  getLogChargedQuota,
  getLogCostComparison,
  OFFICIAL_PRICE_USD_TO_CNY,
} from '../lib/cost-comparison'
import { hasToolSurcharge } from '../lib/format'
import { resolveModelProvider } from '../lib/model-provider'
import type { LogOtherData } from '../types'

interface LogCostDisplayProps {
  modelName?: string
  quota: number
  other: LogOtherData | null
  showBillingSource?: boolean
}

function ToolSurchargeMarker() {
  const { t } = useTranslation()
  const label = t('Includes tool-call surcharge')
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant='warning'
            className='h-5 min-w-5 cursor-help gap-0 rounded-full px-1'
            role='img'
            aria-label={label}
            tabIndex={0}
            data-tool-surcharge-indicator='true'
          >
            <HugeiconsIcon
              icon={Wrench01Icon}
              strokeWidth={2}
              aria-hidden='true'
            />
            <span
              className='text-[9px] leading-none font-bold'
              aria-hidden='true'
            >
              +
            </span>
          </Badge>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function LogCostDisplay(props: LogCostDisplayProps) {
  const { t, i18n } = useTranslation()
  const { status } = useStatus()
  const quotaPerUnit = useSystemConfigStore(
    (state) => state.config.currency.quotaPerUnit
  )
  const isSubscription = props.other?.billing_source === 'subscription'
  const chargedQuota = getLogChargedQuota(props.quota, props.other)
  const showToolSurcharge = hasToolSurcharge(props.other)
  const priceRate = Math.max(Number(status?.price ?? 1), 0.001)
  const referenceCurrency = resolveModelProvider(
    props.modelName ?? ''
  )?.referenceCurrency
  const comparison = getLogCostComparison(props.quota, props.other, {
    priceRate,
    quotaPerUnit,
    referenceCurrency,
  })
  const savingsPercent = comparison
    ? ((comparison.savings / comparison.baseCost) * 100).toLocaleString(
        toIntlLocale(i18n.language),
        { maximumFractionDigits: 2 }
      )
    : null
  const savingsLabel =
    savingsPercent === null
      ? undefined
      : t('Cheaper by {{percent}}%', { percent: savingsPercent })

  let officialPrice = ''
  if (comparison) {
    officialPrice =
      referenceCurrency === 'USD'
        ? new Intl.NumberFormat(toIntlLocale(i18n.language), {
            style: 'currency',
            currency: 'USD',
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
          }).format(comparison.baseCost / OFFICIAL_PRICE_USD_TO_CNY)
        : formatEasySavingsCny(comparison.baseCost)
  }

  let source: string | undefined
  if (isSubscription) {
    source = t('Subscription')
  } else if (
    props.showBillingSource &&
    props.other?.billing_source === 'wallet'
  ) {
    source = t('Wallet')
  }
  const sourceMarker = source ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className='inline-flex shrink-0 cursor-help items-center'
            role='img'
            aria-label={source}
            tabIndex={0}
          >
            <HugeiconsIcon
              icon={isSubscription ? CrownIcon : Wallet01Icon}
              className='size-3.5'
              strokeWidth={2}
              aria-hidden='true'
            />
          </span>
        }
      />
      <TooltipContent>{source}</TooltipContent>
    </Tooltip>
  ) : null

  if (isSubscription) {
    const quota = props.other?.subscription_consumed ?? props.quota
    return (
      <TooltipProvider>
        <div className='inline-flex items-center gap-1.5'>
          <StatusBadge
            type='badge'
            variant='neutral'
            size='lg'
            copyable={false}
            className='border-border/80 bg-muted/60 text-foreground rounded-md border font-semibold tabular-nums'
          >
            {sourceMarker}
            <span className='whitespace-nowrap'>{formatLogQuota(quota)}</span>
          </StatusBadge>
          {showToolSurcharge ? <ToolSurchargeMarker /> : null}
        </div>
      </TooltipProvider>
    )
  }

  if (chargedQuota === 0) {
    return (
      <span className='text-sm font-semibold tabular-nums'>{t('Cost')} 0</span>
    )
  }

  const costContent = comparison ? (
    <div
      className='dopa-cost-stack'
      data-testid='log-savings-comparison'
      aria-label={savingsLabel}
    >
      <span className='dopa-cost-stack__official'>
        <Tooltip>
          <TooltipTrigger
            render={<span tabIndex={0} className='cursor-help' />}
          >
            {t('Official price')}
          </TooltipTrigger>
          <TooltipContent>
            {referenceCurrency
              ? t(
                  'Estimated from the recorded base price. The reference currency follows the model family; provider official pricing has not been independently verified.'
                )
              : t(
                  'Estimated from the recorded model base price; provider official pricing has not been independently verified.'
                )}
            {referenceCurrency === 'USD' && (
              <p>
                {t(
                  'Official prices are shown in USD. Savings use 1 USD = {{rate}} CNY.',
                  { rate: OFFICIAL_PRICE_USD_TO_CNY }
                )}
              </p>
            )}
          </TooltipContent>
        </Tooltip>{' '}
        <del>{officialPrice}</del>
      </span>
      <span className='dopa-cost-stack__actual'>
        {t('Yecai price')} {formatEasySavingsCny(comparison.siteCost)}
      </span>
      {savingsLabel && (
        <span className='dopa-cost-stack__saved'>{savingsLabel}</span>
      )}
    </div>
  ) : (
    <div className='flex items-center gap-1 text-xs'>
      <span>{t('Yecai price')}</span>
      <span className='border-border/80 bg-muted/60 inline-flex h-6 w-fit items-center rounded-md border px-2 font-semibold tabular-nums'>
        {formatEasySavingsCny((chargedQuota / quotaPerUnit) * priceRate)}
      </span>
    </div>
  )

  return (
    <TooltipProvider>
      <div className='inline-flex w-fit items-center gap-1.5'>
        {sourceMarker}
        {costContent}
        {showToolSurcharge ? <ToolSurchargeMarker /> : null}
      </div>
    </TooltipProvider>
  )
}
