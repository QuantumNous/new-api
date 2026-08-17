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
import { Copy } from 'lucide-react'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { ModelStatusEntry } from '@/features/status/api'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getLobeIcon } from '@/lib/lobe-icon'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import type { PricingModel, TokenUnit } from '../types'
import { ModelStatusStrip } from './model-status-strip'

export interface ModelCardProps {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  status?: ModelStatusEntry
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const modelIconKey = props.model.icon || props.model.vendor_icon
  const modelIcon = modelIconKey ? getLobeIcon(modelIconKey, 28) : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const isDynamicPricing =
    props.model.billing_mode === 'tiered_expr' &&
    Boolean(props.model.billing_expr)
  const dynamicSummary = isDynamicPricing
    ? getDynamicPricingSummary(props.model, {
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        groupRatioMultiplier: getDynamicDisplayGroupRatio(
          props.model,
          props.selectedGroup
        ),
      })
    : null

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(props.model.model_name || '')
  }

  let priceSummary: ReactNode
  if (dynamicSummary) {
    if (dynamicSummary.primaryEntries.length > 0) {
      priceSummary = dynamicSummary.primaryEntries.map((entry) => (
        <span key={entry.key} className='whitespace-nowrap'>
          {t(entry.shortLabel)}{' '}
          <span className='text-foreground font-mono font-semibold'>
            {entry.formatted}
          </span>
        </span>
      ))
    } else {
      priceSummary = (
        <span className='text-muted-foreground'>{t('Dynamic Pricing')}</span>
      )
    }
  } else if (isTokenBased) {
    priceSummary = (
      <>
        <span className='whitespace-nowrap'>
          {t('Input')}{' '}
          <span className='text-foreground font-mono font-semibold'>
            {formatPrice(
              props.model,
              'input',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.selectedGroup
            )}
          </span>
        </span>
        <span className='whitespace-nowrap'>
          {t('Output')}{' '}
          <span className='text-foreground font-mono font-semibold'>
            {formatPrice(
              props.model,
              'output',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.selectedGroup
            )}
          </span>
        </span>
      </>
    )
  } else {
    priceSummary = (
      <span className='whitespace-nowrap'>
        <span className='text-foreground font-mono font-semibold'>
          {formatRequestPrice(
            props.model,
            showRechargePrice,
            priceRate,
            usdExchangeRate,
            props.selectedGroup
          )}
        </span>{' '}
        / {t('request')}
      </span>
    )
  }

  return (
    <button
      type='button'
      onClick={props.onClick}
      className='group border-landing-primary/15 hover:border-landing-primary/40 hover:bg-landing-primary/5 relative flex w-full flex-col rounded-2xl border p-4 text-left transition-colors sm:p-5'
    >
      <div className='flex items-start gap-3'>
        <div className='bg-landing-tint/60 text-landing-primary-strong dark:text-landing-primary flex size-10 shrink-0 items-center justify-center rounded-xl'>
          {modelIcon || <span className='text-sm font-bold'>{initial}</span>}
        </div>
        <div className='min-w-0 flex-1'>
          <h3 className='text-foreground truncate font-mono text-[15px] leading-tight font-bold'>
            {props.model.model_name}
          </h3>
          <div className='text-muted-foreground mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm'>
            {priceSummary}
          </div>
        </div>
        <span
          role='button'
          tabIndex={-1}
          onClick={handleCopy}
          className='text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100'
          title={t('Copy')}
        >
          <Copy className='size-3.5' />
        </span>
      </div>

      <p className='text-muted-foreground mt-3 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed'>
        {props.model.description || t('No description available.')}
      </p>

      <ModelStatusStrip
        status={props.status}
        className='border-landing-primary/10 mt-3 border-t pt-3'
      />
    </button>
  )
})
