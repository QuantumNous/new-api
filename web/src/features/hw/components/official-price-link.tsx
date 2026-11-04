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
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { guideText } from '../data/model-guide'
import {
  MODEL_PRICES,
  OFFICIAL_PRICING_URL,
  priceOf,
  type ModelPrice,
} from '../data/model-prices'

type OfficialPriceLinkProps = {
  model: string | undefined
  /** Language of the text; defaults to the interface language. */
  language?: string
  models?: readonly ModelPrice[]
  className?: string
}

const LINK_TEXT = { tr: 'Resmi fiyat', en: 'Official price' }
const LIST_TEXT = {
  tr: '1M token liste fiyatı',
  en: 'list price per 1M tokens',
}
const NO_LIST_TEXT = { tr: 'liste fiyatı yok', en: 'no list price' }

/**
 * Link to the provider's own API pricing page, with the official list price
 * next to it, so a customer can check the price we halve. Renders nothing for
 * a model we do not sell.
 */
export function OfficialPriceLink(props: OfficialPriceLinkProps) {
  const { i18n } = useTranslation()
  const entry = priceOf(props.model, props.models ?? MODEL_PRICES)
  if (!entry) return null
  const language = props.language ?? i18n.resolvedLanguage ?? i18n.language
  const list = entry.official
  return (
    <p
      className={cn('text-muted-foreground text-xs', props.className)}
      data-testid='hw-official-price'
    >
      <a
        href={OFFICIAL_PRICING_URL[entry.provider]}
        target='_blank'
        rel='noopener noreferrer'
        className='text-primary inline-flex items-center gap-1 underline-offset-2 hover:underline'
      >
        {guideText(LINK_TEXT, language)} ({entry.provider})
        <ExternalLink aria-hidden className='size-3' />
      </a>
      {': '}
      {list
        ? `$${list.input} / $${list.output} ${guideText(LIST_TEXT, language)}`
        : guideText(NO_LIST_TEXT, language)}
    </p>
  )
}
