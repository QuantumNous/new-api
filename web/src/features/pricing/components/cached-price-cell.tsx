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

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
  isUnconfiguredTaskUsageModel,
} from '../lib/dynamic-price'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, stripTrailingZeros } from '../lib/price'
import type { PricingModel } from '../types'
import type { ModelPriceCellOptions } from './model-price-cell'

export function CachedPriceCell(props: {
  model: PricingModel
  options: ModelPriceCellOptions
}) {
  const { t } = useTranslation()
  const {
    tokenUnit = DEFAULT_TOKEN_UNIT,
    priceRate = 1,
    usdExchangeRate = 1,
    showRechargePrice = false,
    selectedGroup,
  } = props.options

  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'

  const model = props.model
  const billingTime = useBillingTime(model.billing_expr)
  const dynamicSummary = getDynamicPricingSummary(model, {
    now: billingTime === undefined ? undefined : new Date(billingTime),
    tokenUnit,
    showRechargePrice,
    priceRate,
    usdExchangeRate,
    groupRatioMultiplier: getDynamicDisplayGroupRatio(model, selectedGroup),
  })

  if (dynamicSummary) {
    if (dynamicSummary.isSpecialExpression) {
      return (
        <span className='text-muted-foreground/50 text-xs'>
          {t('Special billing expression')}
        </span>
      )
    }

    const cacheEntry = dynamicSummary.entries.find(
      (entry) => entry.field === 'cacheReadPrice'
    )
    if (!cacheEntry) {
      return <span className='text-muted-foreground/30 text-xs'>—</span>
    }

    return (
      <div className='max-w-full min-w-0'>
        <span className='font-mono text-sm tabular-nums'>
          {stripTrailingZeros(cacheEntry.formatted)}
        </span>
        <div className='text-muted-foreground/50 text-[10px]'>
          / {tokenUnitLabel}
        </div>
      </div>
    )
  }

  if (isUnconfiguredTaskUsageModel(model)) {
    return <span className='text-muted-foreground/30 text-xs'>—</span>
  }

  const isTokenBased = isTokenBasedModel(model)

  if (!isTokenBased || model.cache_ratio == null) {
    return <span className='text-muted-foreground/30 text-xs'>—</span>
  }

  const cachedPrice = stripTrailingZeros(
    formatPrice(
      model,
      'cache',
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      selectedGroup
    )
  )

  return (
    <div className='max-w-full min-w-0'>
      <span className='font-mono text-sm tabular-nums'>{cachedPrice}</span>
      <div className='text-muted-foreground/50 text-[10px]'>
        / {tokenUnitLabel}
      </div>
    </div>
  )
}
