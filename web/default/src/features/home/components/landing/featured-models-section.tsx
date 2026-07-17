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
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { QUOTA_TYPE_VALUES } from '@/features/pricing/constants'
import { formatPrice, formatRequestPrice } from '@/features/pricing/lib/price'
import { getLobeIcon } from '@/lib/lobe-icon'

import type { HomeCatalogModel } from '../../lib/catalog'
import { SectionHeading } from './section-heading'

interface FeaturedModelsSectionProps {
  models: HomeCatalogModel[]
  isLoading: boolean
}

const TOKEN_COUNT_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})
const MODEL_LOADING_KEYS = Array.from(
  { length: 6 },
  (_, position) => `model-loading-${position + 1}`
)

function formatTokenCount(tokens: number | undefined): string | null {
  if (!tokens || tokens <= 0) return null
  if (tokens >= 1_000_000) {
    return `${TOKEN_COUNT_FORMAT.format(tokens / 1_000_000)}M`
  }
  if (tokens >= 1_000) {
    return `${TOKEN_COUNT_FORMAT.format(tokens / 1_000)}K`
  }
  return TOKEN_COUNT_FORMAT.format(tokens)
}

function ModelPreviewCard(props: { model: HomeCatalogModel }) {
  const { t } = useTranslation()
  const model = props.model
  const iconKey = model.icon || model.vendor_icon || model.vendor_name
  const endpoint = model.supported_endpoint_types?.[0]
  const context = formatTokenCount(model.context_length)
  const isRequestPriced = model.quota_type === QUOTA_TYPE_VALUES.REQUEST
  const inputPrice = isRequestPriced
    ? formatRequestPrice(model)
    : formatPrice(model, 'input', 'M')
  const outputPrice = isRequestPriced ? null : formatPrice(model, 'output', 'M')

  return (
    <Card className='min-h-72 rounded-lg' data-card-hover='true'>
      <CardHeader>
        <div className='bg-muted mb-3 flex size-10 items-center justify-center rounded-lg'>
          {getLobeIcon(iconKey, 26)}
        </div>
        <CardTitle className='truncate text-lg'>{model.model_name}</CardTitle>
        <CardDescription className='line-clamp-2 min-h-10 leading-5'>
          {model.description ||
            model.vendor_description ||
            t('Available through the unified API gateway.')}
        </CardDescription>
        {model.vendor_name && (
          <CardAction>
            <Badge variant='outline'>{model.vendor_name}</Badge>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className='mt-auto grid grid-cols-2 gap-4'>
        <div>
          <p className='text-muted-foreground text-xs'>
            {isRequestPriced ? t('Price') : t('Input')}
          </p>
          <p className='mt-1 font-mono text-sm font-semibold tabular-nums'>
            {inputPrice}
          </p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs'>
            {outputPrice ? t('Output') : t('Billing')}
          </p>
          <p className='mt-1 truncate font-mono text-sm font-semibold tabular-nums'>
            {outputPrice || t('Per request')}
          </p>
        </div>
      </CardContent>

      <CardFooter className='justify-between gap-3'>
        <span className='text-muted-foreground text-xs'>
          {context ? `${t('Context')} ${context}` : t('Live catalog')}
        </span>
        <span className='text-muted-foreground max-w-28 truncate text-xs'>
          {endpoint || t('Compatible API')}
        </span>
      </CardFooter>
    </Card>
  )
}

function ModelsLoadingGrid() {
  return (
    <div className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
      {MODEL_LOADING_KEYS.map((key) => (
        <Card key={key} className='min-h-72 rounded-lg'>
          <CardHeader>
            <Skeleton className='mb-3 size-10 rounded-lg' />
            <Skeleton className='h-5 w-2/3' />
            <Skeleton className='h-10 w-full' />
          </CardHeader>
          <CardContent className='mt-auto grid grid-cols-2 gap-4'>
            <Skeleton className='h-10' />
            <Skeleton className='h-10' />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function FeaturedModelsSection(props: FeaturedModelsSectionProps) {
  const { t } = useTranslation()

  if (!props.isLoading && props.models.length === 0) return null

  return (
    <section className='px-4 py-20 sm:px-6 sm:py-24 lg:py-28'>
      <div className='mx-auto w-full max-w-6xl'>
        <SectionHeading
          eyebrow={t('Featured models')}
          title={t('Find the right model for every task.')}
          description={t(
            'Compare capabilities, context, endpoints, and pricing before sending a request with one API key.'
          )}
        />

        {props.isLoading ? (
          <ModelsLoadingGrid />
        ) : (
          <div className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
            {props.models.map((model) => (
              <ModelPreviewCard key={model.model_name} model={model} />
            ))}

            <Link to='/pricing' className='group block'>
              <Card className='min-h-72 rounded-lg' data-card-hover='true'>
                <CardHeader>
                  <div className='bg-primary/10 text-primary mb-3 flex size-10 items-center justify-center rounded-lg text-lg font-semibold'>
                    +
                  </div>
                  <CardTitle>{t('More models')}</CardTitle>
                  <CardDescription className='min-h-10 leading-5'>
                    {t('Browse the complete model catalog and live pricing.')}
                  </CardDescription>
                  <CardAction>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className='text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5'
                      aria-hidden='true'
                    />
                  </CardAction>
                </CardHeader>
                <CardFooter className='mt-auto justify-between'>
                  <span className='text-muted-foreground text-xs'>
                    {t('Live catalog')}
                  </span>
                  <span className='text-xs font-medium'>
                    {t('View all models')}
                  </span>
                </CardFooter>
              </Card>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
