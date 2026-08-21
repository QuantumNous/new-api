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
import { Alert02Icon, Copy01Icon, FlashIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { getLobeIcon } from '@/lib/lobe-icon'
import { getModelAvailabilityConfig } from '@/lib/model-availability'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/status-badge'
import {
  getModelEndpointLabel,
  isGenericModelEndpoint,
  normalizeModelAvailabilityStatus,
} from '../lib/model-access-browser'
import { getModelQuickstartLink } from '../lib/model-catalog-actions'
import { resolveModelBrand } from '../lib/model-catalog-brand'
import type { CatalogPrice } from '../lib/model-catalog-price'
import {
  getModelCategory,
  getModelCategoryLabel,
} from '../lib/model-catalog-type'
import type { ModelAccessModel } from '../types'

export type ModelCatalogCardProps = {
  model: ModelAccessModel
  price: CatalogPrice
}

/** Unit prices are small; four significant decimals keep them readable. */
const PRICE_FORMAT = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }

function formatUnitPrice(amountUSD: number): string {
  return formatBillingCurrencyFromUSD(amountUSD, PRICE_FORMAT)
}

function PriceRow(props: {
  label: string
  value: string
  official?: string | null
}) {
  const { t } = useTranslation()

  return (
    <div className='flex items-baseline justify-between gap-3'>
      <span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
        {props.label}
      </span>
      <span className='flex min-w-0 items-baseline gap-2'>
        {props.official && (
          // `<s>` over a styling-only class so assistive tech announces the
          // official rate as superseded rather than as the current price.
          <s className='text-muted-foreground/70 min-w-0 truncate font-mono text-sm tabular-nums'>
            <span className='sr-only'>{t('Official price')} </span>
            {props.official}
          </s>
        )}
        <span
          className={cn(
            'min-w-0 truncate font-mono text-lg font-bold tabular-nums',
            props.official && 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {props.value}
        </span>
      </span>
    </div>
  )
}

function PriceKicker(props: { children: string }) {
  return (
    <span className='text-muted-foreground text-[11px] font-bold tracking-[0.08em] uppercase'>
      {props.children}
    </span>
  )
}

/** Kicker row that carries the saving badge when the model is discounted. */
function PriceHeader(props: { label: string; discountPercent: number | null }) {
  const { t } = useTranslation()

  return (
    <div className='flex items-center justify-between gap-2'>
      <PriceKicker>{props.label}</PriceKicker>
      {props.discountPercent !== null && (
        <Badge className='shrink-0 border-transparent bg-emerald-600 text-white dark:bg-emerald-500'>
          {t('Save {{percent}}%', { percent: props.discountPercent })}
        </Badge>
      )}
    </div>
  )
}

function ModelPricePanel(props: { price: CatalogPrice }) {
  const { t } = useTranslation()
  const { price } = props

  if (price.kind === 'none') return null

  if (price.kind === 'dynamic') {
    return (
      <div className='mt-auto flex flex-col gap-2 border-t pt-4'>
        <PriceKicker>{t('Billing')}</PriceKicker>
        <p className='text-base font-semibold'>{t('Dynamic pricing')}</p>
        <p className='text-muted-foreground text-xs leading-relaxed'>
          {t('Price depends on request size and options.')}
        </p>
      </div>
    )
  }

  if (price.kind === 'request') {
    return (
      <div className='mt-auto flex flex-col gap-2 border-t pt-4'>
        <PriceHeader
          label={t('Per request')}
          discountPercent={price.discountPercent}
        />
        <PriceRow
          label={t('Price')}
          value={formatUnitPrice(price.priceUSD)}
          official={
            price.officialUSD === null
              ? null
              : formatUnitPrice(price.officialUSD)
          }
        />
      </div>
    )
  }

  return (
    <div className='mt-auto flex flex-col gap-2 border-t pt-4'>
      <PriceHeader
        label={t('Per 1M tokens')}
        discountPercent={price.discountPercent}
      />
      <PriceRow
        label={t('Input')}
        value={formatUnitPrice(price.inputUSD)}
        official={
          price.officialInputUSD === null
            ? null
            : formatUnitPrice(price.officialInputUSD)
        }
      />
      {price.outputUSD !== null && (
        <PriceRow
          label={t('Output')}
          value={formatUnitPrice(price.outputUSD)}
          official={
            price.officialOutputUSD === null
              ? null
              : formatUnitPrice(price.officialOutputUSD)
          }
        />
      )}
    </div>
  )
}

export function ModelCatalogCard({ model, price }: ModelCatalogCardProps) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const availability = getModelAvailabilityConfig(t)
  const officiallyUnsupported =
    model.availability_status === 'official_unsupported'
  const availabilityConfig =
    availability[normalizeModelAvailabilityStatus(model.availability_status)] ||
    availability.unknown_failure
  const category = getModelCategory(model)
  const categoryLabel = getModelCategoryLabel(category, t)
  const brand = resolveModelBrand(model)
  // "OpenAI Compatible" is true of nearly every model here, so as a badge it
  // costs a slot and tells the reader nothing. The category badge already
  // leads the row, so an endpoint resolving to the same word ("Video" for a
  // video endpoint) is dropped too rather than shown twice side by side.
  const endpointLabels = Array.from(
    new Set(
      model.supported_endpoint_types
        .filter((endpoint) => !isGenericModelEndpoint(endpoint))
        .map((endpoint) => getModelEndpointLabel(endpoint, t))
    )
  ).filter((label) => label !== categoryLabel)

  return (
    <article
      className={cn(
        'bg-card ring-foreground/10 flex min-w-0 flex-col gap-4 rounded-2xl p-5 ring-1 transition-all sm:p-6',
        'hover:ring-foreground/20 hover:-translate-y-0.5 hover:shadow-lg',
        officiallyUnsupported && 'ring-destructive/40 bg-destructive/5'
      )}
    >
      <div className='flex min-w-0 items-start gap-3.5'>
        <span className='bg-muted/70 ring-foreground/5 flex size-12 shrink-0 items-center justify-center rounded-xl ring-1'>
          {getLobeIcon(brand.icon, 26)}
        </span>
        <div className='min-w-0 flex-1'>
          <h3
            className='truncate text-lg leading-tight font-bold'
            title={model.id}
          >
            {model.id}
          </h3>
          <p className='text-muted-foreground mt-1 truncate text-sm font-medium'>
            {brand.name ?? t('Unknown')}
          </p>
        </div>
        {officiallyUnsupported ? (
          <Badge variant='destructive' className='shrink-0'>
            <HugeiconsIcon
              icon={Alert02Icon}
              strokeWidth={2}
              data-icon='inline-start'
              aria-hidden='true'
            />
            {t('Not callable')}
          </Badge>
        ) : (
          <StatusBadge
            className='shrink-0'
            label={availabilityConfig.label}
            variant={availabilityConfig.variant}
            copyable={false}
          />
        )}
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type='button'
              className='bg-muted/60 hover:bg-muted focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none'
              aria-label={t('Copy to clipboard')}
              onClick={() => void copyToClipboard(model.id)}
            />
          }
        >
          <span className='text-muted-foreground min-w-0 flex-1 truncate font-mono text-sm'>
            {model.id}
          </span>
          <HugeiconsIcon
            icon={Copy01Icon}
            strokeWidth={2}
            className='size-4 shrink-0'
            aria-hidden='true'
          />
        </TooltipTrigger>
        <TooltipContent>{t('Copy to clipboard')}</TooltipContent>
      </Tooltip>

      {model.description && (
        <p className='text-muted-foreground line-clamp-2 text-sm leading-relaxed'>
          {model.description}
        </p>
      )}

      {officiallyUnsupported && (
        <p className='text-destructive text-sm font-medium'>
          {t(
            'This model cannot be called because upstreams no longer support it.'
          )}
        </p>
      )}

      <div className='flex flex-wrap gap-2'>
        <Badge variant='secondary'>{categoryLabel}</Badge>
        {endpointLabels.map((endpoint) => (
          <Badge key={endpoint} variant='outline'>
            {endpoint}
          </Badge>
        ))}
        {model.supported_endpoint_types.length === 0 && (
          <Badge variant='outline'>{t('Endpoint not specified')}</Badge>
        )}
      </div>

      <ModelPricePanel price={price} />

      <div className='flex border-t pt-4'>
        <Button
          size='lg'
          className='min-w-0 flex-1'
          render={<Link {...getModelQuickstartLink(model.id)} />}
        >
          <HugeiconsIcon
            icon={FlashIcon}
            strokeWidth={2}
            data-icon='inline-start'
            aria-hidden='true'
          />
          {t('Quick start')}
        </Button>
      </div>
    </article>
  )
}
