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

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { QUOTA_TYPE_VALUES } from '@/features/pricing/constants'
import { formatPrice, formatRequestPrice } from '@/features/pricing/lib/price'
import { getLobeIcon } from '@/lib/lobe-icon'

import type { HomeCatalogModel } from '../../lib/catalog'
import { SectionHeading } from './section-heading'

interface PricingPreviewSectionProps {
  models: HomeCatalogModel[]
  isLoading: boolean
}

const PRICING_LOADING_KEYS = Array.from(
  { length: 4 },
  (_, position) => `pricing-loading-${position + 1}`
)

function PricingLoading() {
  return (
    <Card className='gap-0 rounded-lg py-0'>
      <div className='border-border grid h-10 grid-cols-3 items-center gap-4 border-b px-4'>
        <Skeleton className='h-3 w-20' />
        <Skeleton className='h-3 w-16' />
        <Skeleton className='h-3 w-16' />
      </div>
      {PRICING_LOADING_KEYS.map((key) => (
        <div
          key={key}
          className='border-border grid h-15 grid-cols-3 items-center gap-4 border-b px-4 last:border-b-0'
        >
          <div className='flex items-center gap-3'>
            <Skeleton className='size-8 rounded-lg' />
            <Skeleton className='h-4 w-28' />
          </div>
          <Skeleton className='h-4 w-16' />
          <Skeleton className='h-4 w-16' />
        </div>
      ))}
    </Card>
  )
}

export function PricingPreviewSection(props: PricingPreviewSectionProps) {
  const { t } = useTranslation()
  const models = props.models.slice(0, 4)

  if (!props.isLoading && models.length === 0) return null

  return (
    <section className='bg-muted/60 px-4 py-20 sm:px-6 sm:py-24 lg:py-28'>
      <div className='mx-auto w-full max-w-6xl'>
        <SectionHeading
          eyebrow={t('Transparent pricing')}
          title={t('See the price before you send a request.')}
          description={t(
            'Models and endpoints can use different billing modes. Live pricing is always shown in the model catalog.'
          )}
        />

        <div className='mb-3 flex items-center justify-between gap-4'>
          <p className='text-muted-foreground flex items-center gap-2 text-xs'>
            <span className='bg-success size-1.5 rounded-full' />
            {t('Prices in USD · live catalog')}
          </p>
          <Button variant='ghost' size='sm' render={<Link to='/pricing' />}>
            {t('View Pricing')}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
        </div>

        {props.isLoading ? (
          <PricingLoading />
        ) : (
          <Card className='gap-0 rounded-lg py-0'>
            <Table>
              <TableHeader>
                <TableRow className='bg-muted/50 hover:bg-muted/50'>
                  <TableHead>{t('Model')}</TableHead>
                  <TableHead>{t('Input / 1M')}</TableHead>
                  <TableHead>{t('Output / 1M')}</TableHead>
                  <TableHead className='hidden sm:table-cell'>
                    {t('Endpoint')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => {
                  const isRequestPriced =
                    model.quota_type === QUOTA_TYPE_VALUES.REQUEST
                  const inputPrice = isRequestPriced
                    ? formatRequestPrice(model)
                    : formatPrice(model, 'input', 'M')
                  const outputPrice = isRequestPriced
                    ? t('Per request')
                    : formatPrice(model, 'output', 'M')
                  const iconKey =
                    model.icon || model.vendor_icon || model.vendor_name

                  return (
                    <TableRow key={model.model_name}>
                      <TableCell>
                        <div className='flex min-w-0 items-center gap-2.5'>
                          <span className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg'>
                            {getLobeIcon(iconKey, 20)}
                          </span>
                          <span className='max-w-40 truncate font-medium'>
                            {model.model_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className='font-mono text-xs sm:text-sm'>
                        {inputPrice}
                      </TableCell>
                      <TableCell className='font-mono text-xs sm:text-sm'>
                        {outputPrice}
                      </TableCell>
                      <TableCell className='text-muted-foreground hidden max-w-36 truncate sm:table-cell'>
                        {model.supported_endpoint_types?.[0] || '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </section>
  )
}
