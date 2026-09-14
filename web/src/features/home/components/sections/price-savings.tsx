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
import { ArrowUpRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  familyIconName,
  filterCatalog,
  sortCatalog,
  uniqueVendors,
  type CatalogModality,
  type CatalogSort,
} from '../../lib/catalog'
import {
  formatPerMillionTokens,
  type SavingsModel,
} from '../../lib/pricing-savings'

interface PriceSavingsProps {
  models: SavingsModel[]
  calculatorModels?: SavingsModel[]
}

const PREVIEW_COUNT = 8

const MODALITIES: CatalogModality[] = ['all', 'text', 'image', 'video']

function modalityLabel(
  t: (key: string) => string,
  modality: CatalogModality,
  counts: Record<CatalogModality, number>
): string {
  if (modality === 'all') return `${t('All models')}${counts.all}`
  if (modality === 'text') return `${t('Text')}${counts.text}`
  if (modality === 'image') return `${t('Image')}${counts.image}`
  return `${t('Video')}${counts.video}`
}

function CatalogRow(props: { model: SavingsModel }) {
  const { t } = useTranslation()
  const model = props.model

  return (
    <Link
      to='/pricing/$modelId'
      params={{ modelId: model.modelName }}
      className='hover:bg-muted/50 grid grid-cols-1 items-center gap-3 border-t px-4 py-4 md:grid-cols-[minmax(0,1.6fr)_0.7fr_0.7fr_0.55fr_auto] md:gap-4'
    >
      <div className='flex min-w-0 items-center gap-3'>
        <span className='bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full'>
          {getLobeIcon(familyIconName(model), 22)}
        </span>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='truncate font-medium'>{model.modelName}</span>
            {model.savingsPercent > 0 ? (
              <span className='rounded-full bg-[var(--ci-lime)] px-2 py-0.5 text-[11px] font-medium text-[#040d10]'>
                {t('Save {{percent}}%', { percent: model.savingsPercent })}
              </span>
            ) : null}
          </div>
          <p className='text-muted-foreground truncate text-xs'>
            {model.vendorName}
          </p>
        </div>
      </div>
      <PriceCell
        list={model.baseInputPrice}
        live={model.siteInputPrice}
        label={t('Input')}
      />
      <PriceCell
        list={model.baseOutputPrice}
        live={model.siteOutputPrice}
        label={t('Output')}
      />
      <div className='text-sm font-medium'>
        <span className='text-muted-foreground mr-2 md:hidden'>
          {t('Discount')}
        </span>
        {model.savingsPercent > 0
          ? t('Save {{percent}}%', { percent: model.savingsPercent })
          : t('Base price')}
      </div>
      <ArrowUpRight className='text-muted-foreground hidden size-4 md:block' />
    </Link>
  )
}

function PriceCell(props: { list: number; live: number; label: string }) {
  return (
    <div className='text-sm'>
      <span className='text-muted-foreground mr-2 md:hidden'>
        {props.label}
      </span>
      <span className='text-muted-foreground mr-1.5 line-through'>
        {formatPerMillionTokens(props.list)}
      </span>
      <span className='font-semibold'>
        {formatPerMillionTokens(props.live)}
      </span>
    </div>
  )
}

export function PriceSavings(props: PriceSavingsProps) {
  const { t } = useTranslation()
  const catalog = props.calculatorModels ?? props.models
  const [query, setQuery] = useState('')
  const [vendor, setVendor] = useState('all')
  const [sort, setSort] = useState<CatalogSort>('discount-desc')
  const [modality, setModality] = useState<CatalogModality>('all')

  const vendors = useMemo(() => uniqueVendors(catalog), [catalog])
  const counts = useMemo(() => {
    const all = catalog.length
    return {
      all,
      text: filterCatalog(catalog, '', 'all', 'text').length,
      image: filterCatalog(catalog, '', 'all', 'image').length,
      video: filterCatalog(catalog, '', 'all', 'video').length,
    }
  }, [catalog])

  const visible = useMemo(
    () =>
      sortCatalog(filterCatalog(catalog, query, vendor, modality), sort).slice(
        0,
        PREVIEW_COUNT
      ),
    [catalog, modality, query, sort, vendor]
  )

  if (catalog.length === 0) {
    return (
      <section
        id='savings-calculator'
        className='scroll-mt-24 px-4 py-8 sm:px-6'
      >
        <div
          className='mx-auto max-w-5xl rounded-2xl border px-6 py-12'
          data-testid='savings-unavailable'
        >
          <p className='text-muted-foreground text-sm'>
            {t('Prices update from the live model catalog.')}{' '}
            {t('Refresh the list and try again.')}
          </p>
          <Button className='mt-6' render={<Link to='/pricing' />}>
            {t('Model prices')}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section
      id='savings-calculator'
      className='scroll-mt-24 px-4 py-6 sm:px-6 md:py-10'
    >
      <div className='mx-auto max-w-5xl'>
        <div className='mb-5 flex items-end justify-between gap-4'>
          <div>
            <p className='mb-2 inline-flex items-center gap-2 text-xs font-medium tracking-wide uppercase'>
              <span className='size-1.5 rounded-full bg-[var(--ci-lime)]' />
              {t('Live')}
            </p>
            <h2 className='text-2xl font-semibold tracking-tight md:text-3xl'>
              {t('See our live catalog rates')}
            </h2>
            <p className='text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed'>
              {t(
                'Browse available model capacity, compare market discounts, and inspect current activity across providers.'
              )}
            </p>
          </div>
        </div>

        <div className='mb-4 flex flex-col gap-3 md:flex-row md:items-center'>
          <label className='border-border bg-background relative flex min-w-0 flex-1 items-center rounded-md border'>
            <Search className='text-muted-foreground ml-3 size-4' />
            <input
              aria-label={t('Search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Search')}
              className='h-9 w-full bg-transparent px-2 text-sm outline-none'
            />
          </label>
          <select
            aria-label={t('Provider')}
            value={vendor}
            onChange={(event) => setVendor(event.target.value)}
            className='border-border bg-background h-9 rounded-md border px-3 text-sm'
          >
            <option value='all'>{t('All providers')}</option>
            {vendors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label={t('Sort by')}
            value={sort}
            onChange={(event) => setSort(event.target.value as CatalogSort)}
            className='border-border bg-background h-9 rounded-md border px-3 text-sm'
          >
            <option value='discount-desc'>{t('Highest discount')}</option>
            <option value='discount-asc'>{t('Lowest discount')}</option>
            <option value='price-asc'>{t('Best price')}</option>
          </select>
        </div>

        <div className='mb-3 flex flex-wrap gap-1.5'>
          {MODALITIES.map((item) => (
            <button
              key={item}
              type='button'
              aria-pressed={modality === item}
              onClick={() => setModality(item)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                modality === item
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {modalityLabel(t, item, counts)}
            </button>
          ))}
        </div>

        <div
          className='overflow-hidden rounded-2xl border'
          data-testid='live-catalog'
        >
          <div
            className='text-muted-foreground hidden grid-cols-[minmax(0,1.6fr)_0.7fr_0.7fr_0.55fr_auto] gap-4 px-4 py-3 text-xs tracking-wide uppercase md:grid'
            data-testid='desktop-price-table'
          >
            <span>{t('Model')}</span>
            <span>{t('Input')}</span>
            <span>{t('Output')}</span>
            <span>{t('Discount')}</span>
            <span />
          </div>
          <div className='md:hidden' data-testid='mobile-price-cards' />
          {visible.length === 0 ? (
            <p className='text-muted-foreground px-4 py-10 text-sm'>
              {t('No models match these filters.')}
            </p>
          ) : (
            visible.map((model) => (
              <CatalogRow key={model.modelName} model={model} />
            ))
          )}
        </div>

        <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Compared with site base prices before group discounts, not official provider prices.'
            )}
          </p>
          <Button variant='outline' size='sm' render={<Link to='/pricing' />}>
            {t('View all {{count}} models', { count: catalog.length })}
          </Button>
        </div>
      </div>
    </section>
  )
}
