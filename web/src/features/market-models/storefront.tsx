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
*/
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PublicLayout } from '@/components/layout'

import { getPublicMarketModels } from './api'
import type { PublicMarketModelItem } from './types'

// Format a price stored as minor units (e.g. CNY 分 / USD cents) per 1M units.
function formatPrice(
  price: number,
  currency: string,
  unit: string,
  t: TFunction
): string {
  const symbol = currency === 'USD' ? '$' : '¥'
  const value = (price / 100).toFixed(2)
  return `${symbol}${value} ${t('market.perUnit', { unit })}`
}

function MarketCard({ item }: { item: PublicMarketModelItem }) {
  const { t } = useTranslation()
  const { model, i18n } = item
  const name = i18n?.name || model.model
  const description = i18n?.description || ''

  return (
    <Card className='flex flex-col'>
      <CardHeader>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <CardTitle className='truncate text-lg'>{name}</CardTitle>
            <CardDescription className='mt-1 flex flex-wrap gap-1'>
              <Badge variant='secondary'>{model.provider}</Badge>
              <Badge variant='outline'>{model.category}</Badge>
              {model.featured && (
                <Badge variant='default'>{t('market.featured')}</Badge>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-3'>
        {description && (
          <p className='text-muted-foreground line-clamp-3 text-sm'>
            {description}
          </p>
        )}

        <div className='grid grid-cols-2 gap-2 text-sm'>
          <div>
            <div className='text-muted-foreground text-xs'>
              {t('market.input')}
            </div>
            <div className='font-medium'>
              {formatPrice(model.input_price, model.currency, model.unit, t)}
            </div>
          </div>
          <div>
            <div className='text-muted-foreground text-xs'>
              {t('market.output')}
            </div>
            <div className='font-medium'>
              {formatPrice(model.output_price, model.currency, model.unit, t)}
            </div>
          </div>
        </div>

        {model.tags && (
          <div className='flex flex-wrap gap-1'>
            {model.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
              .map((tag) => (
                <Badge key={tag} variant='outline' className='text-xs'>
                  {tag}
                </Badge>
              ))}
          </div>
        )}

        <div className='mt-auto pt-2'>
          <Link
            to='/register'
            className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 w-full items-center justify-center rounded-md px-4 text-sm font-medium'
          >
            {t('market.tryFree')}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export function MarketStorefront() {
  const { t, i18n } = useTranslation()
  // Backend resolves i18n overlays for `zh` / `en` only.
  const locale = i18n.language?.startsWith('zh') ? 'zh' : 'en'

  const { data, isLoading } = useQuery<PublicMarketModelItem[]>({
    queryKey: ['publicMarketModels', locale],
    queryFn: () => getPublicMarketModels(locale),
  })

  const items = data ?? []

  return (
    <PublicLayout>
      <div className='mx-auto max-w-6xl'>
        <header className='mb-8'>
          <h1 className='text-3xl font-bold'>{t('market.title')}</h1>
          <p className='text-muted-foreground mt-2'>{t('market.subtitle')}</p>
        </header>

        {isLoading ? (
          <p className='text-muted-foreground'>{t('market.loading')}</p>
        ) : items.length === 0 ? (
          <p className='text-muted-foreground'>{t('market.noModels')}</p>
        ) : (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {items.map((item) => (
              <MarketCard key={item.model.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
