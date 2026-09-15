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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { getBillingModeLabelKey } from '@/features/pricing/lib/billing-mode'

import type { CatalogEntry } from '../lib/catalog'
import { formatPerMillionTokens } from '../lib/pricing-savings'

export function CatalogPrice(props: {
  model: CatalogEntry
  side: 'input' | 'output'
}) {
  const { t } = useTranslation()
  const quote = props.model.quote
  if (!quote) {
    return (
      <Link to='/pricing/$modelId' params={{ modelId: props.model.modelName }}>
        {t(getBillingModeLabelKey(props.model.pricingModel))}
      </Link>
    )
  }
  const base =
    props.side === 'input' ? quote.baseInputPrice : quote.baseOutputPrice
  const site =
    props.side === 'input' ? quote.siteInputPrice : quote.siteOutputPrice
  return (
    <div className='ci-priceCell'>
      <s>{formatPerMillionTokens(base)}</s>
      <b>{formatPerMillionTokens(site)}</b>
    </div>
  )
}
