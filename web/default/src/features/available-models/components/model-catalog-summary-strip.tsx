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
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import type { ModelCatalogSummary } from '../lib/model-catalog-summary'
import {
  getModelCategoryLabel,
  type ModelCategory,
} from '../lib/model-catalog-type'

/** Headline figures stay short; six decimals would swamp the tile. */
const PRICE_FORMAT = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }

/** At most three price tiles fit beside the total without crowding. */
const MAX_PRICE_TILES = 3

/**
 * Which categories earn a price tile, most interesting first. Generative media
 * is what people come to the catalog to price; a "$0.02 rerank" headline is
 * technically the cheapest number on the page and the least useful one.
 */
const PRICE_TILE_PRIORITY: ModelCategory[] = [
  'image',
  'video',
  'chat',
  'audio',
  'embedding',
  'rerank',
]

function SummaryTile(props: {
  label: string
  value: string
  note: string
  accent?: boolean
}) {
  return (
    <div className='bg-card ring-foreground/10 flex min-w-0 flex-col gap-1.5 rounded-2xl p-5 ring-1'>
      <span className='text-muted-foreground truncate text-xs font-bold tracking-wide uppercase'>
        {props.label}
      </span>
      <strong className='truncate text-3xl leading-none font-black tabular-nums'>
        {props.value}
      </strong>
      <span
        className={
          props.accent
            ? 'text-success truncate text-xs font-semibold'
            : 'text-muted-foreground truncate text-xs font-medium'
        }
      >
        {props.note}
      </span>
    </div>
  )
}

export function ModelCatalogSummaryStrip(props: {
  summary: ModelCatalogSummary
}) {
  const { t } = useTranslation()
  const { summary } = props

  if (summary.total === 0) return null

  // The full breakdown would overflow the tile once a scope spans five or six
  // categories, so it names the three largest and counts the rest.
  const ranked = [...summary.breakdown].sort((a, b) => b.count - a.count)
  const named = ranked.slice(0, 3)
  const remaining = ranked.length - named.length
  const breakdownNote = [
    named
      .map(
        (entry) => `${getModelCategoryLabel(entry.category, t)} ${entry.count}`
      )
      .join(' · '),
    remaining > 0 ? t('+{{count}} more', { count: remaining }) : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const priceTiles = [...summary.categoryPrices]
    .sort(
      (a, b) =>
        PRICE_TILE_PRIORITY.indexOf(a.category) -
        PRICE_TILE_PRIORITY.indexOf(b.category)
    )
    .slice(0, MAX_PRICE_TILES)

  return (
    <section
      className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'
      aria-label={t('Model catalog overview')}
    >
      <SummaryTile
        label={t('Available models')}
        value={String(summary.total)}
        note={breakdownNote}
      />
      {priceTiles.map((entry) => (
        <SummaryTile
          key={entry.category}
          label={t('Lowest {{category}} price', {
            category: getModelCategoryLabel(entry.category, t),
          })}
          value={formatBillingCurrencyFromUSD(
            entry.lowest.amountUSD,
            PRICE_FORMAT
          )}
          accent
          note={
            entry.lowest.unit === 'token'
              ? entry.mixedBilling
                ? t('Per 1M input tokens · some models bill per request')
                : t('Per 1M input tokens')
              : t('Per request')
          }
        />
      ))}
    </section>
  )
}
