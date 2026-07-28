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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getLobeIcon } from '@/lib/lobe-icon'

import { DEFAULT_PRICING_PAGE_SIZE, DEFAULT_TOKEN_UNIT } from '../constants'
import { groupModelsByVendor } from '../lib/model-helpers'
import type { PricingModel, TokenUnit } from '../types'
import { ModelCard } from './model-card'

export interface ModelCardGridProps {
  models: PricingModel[]
  onModelClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
}

/** Content signature so page resets on real list changes, not only identity. */
function modelsListSignature(models: PricingModel[]): string {
  if (models.length === 0) return '0'
  const first = models[0]
  const last = models.at(-1)
  const mid = models[Math.floor(models.length / 2)]
  return [
    models.length,
    first?.id ?? '',
    first?.model_name ?? '',
    mid?.id ?? '',
    mid?.model_name ?? '',
    last?.id ?? '',
    last?.model_name ?? '',
  ].join('|')
}

export function ModelCardGrid(props: ModelCardGridProps) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const pageSize = DEFAULT_PRICING_PAGE_SIZE
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const totalPages = Math.max(1, Math.ceil(props.models.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const listSignature = useMemo(
    () => modelsListSignature(props.models),
    [props.models]
  )

  useEffect(() => {
    setPage(1)
  }, [listSignature])

  const pagedModels = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return props.models.slice(start, start + pageSize)
  }, [currentPage, pageSize, props.models])

  const vendorTotalCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const model of props.models) {
      const key = model.vendor_name?.trim() || '__other__'
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return counts
  }, [props.models])

  const vendorGroups = useMemo(
    () => groupModelsByVendor(pagedModels, t('Other')),
    [pagedModels, t]
  )

  if (props.models.length === 0) {
    return null
  }

  return (
    <div className='space-y-6 sm:space-y-8'>
      {vendorGroups.map((group) => {
        const countKey = group.key.startsWith('other:')
          ? '__other__'
          : group.name
        const totalForVendor =
          vendorTotalCounts.get(countKey) ?? group.models.length
        const shownForVendor = group.models.length
        const vendorIcon = group.icon ? getLobeIcon(group.icon, 20) : null
        const initial = group.name.charAt(0).toUpperCase() || '?'
        const countLabel =
          shownForVendor < totalForVendor
            ? t('{{shown}} of {{total}} models', {
                shown: shownForVendor,
                total: totalForVendor,
              })
            : t('{{count}} models', { count: totalForVendor })

        return (
          <section key={group.key} className='space-y-3 sm:space-y-4'>
            <header className='flex items-center justify-between gap-3 border-b pb-2.5'>
              <div className='flex min-w-0 items-center gap-2.5'>
                <div className='bg-muted/50 flex size-8 shrink-0 items-center justify-center rounded-lg'>
                  {vendorIcon || (
                    <span className='text-muted-foreground text-xs font-bold'>
                      {initial}
                    </span>
                  )}
                </div>
                <div className='min-w-0'>
                  <h2 className='truncate text-sm font-semibold tracking-tight sm:text-base'>
                    {group.name}
                  </h2>
                  <p className='text-muted-foreground text-xs'>
                    {t('{{count}} available services', {
                      count: totalForVendor,
                    })}
                    {shownForVendor < totalForVendor
                      ? ` · ${countLabel}`
                      : null}
                  </p>
                </div>
              </div>
            </header>

            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3 xl:grid-cols-4'>
              {group.models.map((model) => (
                <ModelCard
                  key={model.id ?? model.model_name}
                  model={model}
                  tokenUnit={tokenUnit}
                  priceRate={props.priceRate}
                  usdExchangeRate={props.usdExchangeRate}
                  showRechargePrice={props.showRechargePrice}
                  selectedGroup={props.selectedGroup}
                  onClick={() => props.onModelClick(model.model_name || '')}
                />
              ))}
            </div>
          </section>
        )
      })}

      {totalPages > 1 && (
        <div className='text-muted-foreground flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row'>
          <p className='text-muted-foreground'>
            {t('Page {{current}} of {{total}}', {
              current: currentPage,
              total: totalPages,
            })}
          </p>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              className='gap-1.5'
            >
              <ChevronLeft className='size-4' />
              {t('Previous page')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={currentPage >= totalPages}
              className='gap-1.5'
            >
              {t('Next page')}
              <ChevronRight className='size-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
