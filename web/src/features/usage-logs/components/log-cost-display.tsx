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
import { Wrench01Icon } from '@hugeicons/core-free-icons'
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
}

function splitQuotaDisplay(value: string): { prefix: string; amount: string } {
  const match = value.match(/^([^0-9+\-.,\s]+)(.+)$/)
  if (!match) return { prefix: '', amount: value }
  return { prefix: match[1], amount: match[2] }
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

function QuotaBadge(props: { amountCny: number }) {
  const quotaDisplay = splitQuotaDisplay(
    Number.isFinite(props.amountCny)
      ? formatEasySavingsCny(props.amountCny)
      : '—'
  )

  return (
    <span className='border-border/80 bg-muted/60 inline-flex h-6 w-fit items-center rounded-md border px-2 [font-family:var(--font-body)] text-sm leading-none font-semibold tabular-nums'>
      {quotaDisplay.prefix ? (
        <span className='mr-1'>{quotaDisplay.prefix}</span>
      ) : null}
      <span>{quotaDisplay.amount}</span>
    </span>
  )
}

function SubscriptionBadge(props: { quota: number }) {
  const { t } = useTranslation()

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <StatusBadge
            label={t('Subscription')}
            variant='success'
            size='sm'
            copyable={false}
            className='cursor-help'
          />
        }
      />
      <TooltipContent>
        <span>
          {t('Deducted by subscription')}: {formatLogQuota(props.quota)}
        </span>
      </TooltipContent>
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

  if (!isSubscription && chargedQuota === 0) {
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
      <QuotaBadge amountCny={(chargedQuota / quotaPerUnit) * priceRate} />
    </div>
  )

  if (!isSubscription && !showToolSurcharge) {
    return (
      <TooltipProvider>
        <div className='flex flex-col gap-0.5'>{costContent}</div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div className='inline-flex items-center gap-1'>
        {isSubscription ? (
          <SubscriptionBadge quota={props.quota} />
        ) : (
          costContent
        )}
        {showToolSurcharge ? <ToolSurchargeMarker /> : null}
      </div>
    </TooltipProvider>
  )
}
