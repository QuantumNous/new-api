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
import { useState } from 'react'
import { PackageIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import type { PricingModel } from '@/features/pricing/types'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  resolveCatalogPrice,
  resolveCatalogPriceRatio,
} from '../lib/model-catalog-price'
import type { ModelAccessModel } from '../types'
import { ModelCatalogCard } from './model-catalog-card'

export const MODEL_CATALOG_PAGE_SIZE = 24

type ModelCatalogGridProps = {
  defaultRatio: number | null
  modelRatios: Readonly<Record<string, number>>
  models: ModelAccessModel[]
  priceIndex: ReadonlyMap<string, PricingModel>
  scopeIsEmpty: boolean
  onClearFilters: () => void
}

type ModelCatalogPaginationState = {
  models: ModelAccessModel[]
  scopeIsEmpty: boolean
  visibleCount: number
}

// eslint-disable-next-line react-refresh/only-export-components
export function getNextVisibleCatalogCount(
  currentCount: number,
  totalCount: number
): number {
  return Math.min(currentCount + MODEL_CATALOG_PAGE_SIZE, totalCount)
}

/**
 * A changed dataset (new filter, new scope) restarts paging, so an expanded
 * page count never leaks across filter changes.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getEffectiveVisibleCatalogCount(
  pagination: ModelCatalogPaginationState,
  models: ModelAccessModel[],
  scopeIsEmpty: boolean
): number {
  if (pagination.models !== models || pagination.scopeIsEmpty !== scopeIsEmpty) {
    return MODEL_CATALOG_PAGE_SIZE
  }
  return pagination.visibleCount
}

export function ModelCatalogGrid({
  defaultRatio,
  modelRatios,
  models,
  priceIndex,
  scopeIsEmpty,
  onClearFilters,
}: ModelCatalogGridProps) {
  const { t } = useTranslation()
  const [pagination, setPagination] = useState<ModelCatalogPaginationState>(
    () => ({
      models,
      scopeIsEmpty,
      visibleCount: MODEL_CATALOG_PAGE_SIZE,
    })
  )

  if (models.length === 0) {
    return (
      <Empty className='min-h-64 border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon
              icon={PackageIcon}
              strokeWidth={2}
              aria-hidden='true'
            />
          </EmptyMedia>
          <EmptyTitle>
            {scopeIsEmpty
              ? t('No available models')
              : t('No models match the selected filters')}
          </EmptyTitle>
          <EmptyDescription>
            {scopeIsEmpty
              ? t(
                  'No models are available in the current scope. Contact your administrator to check model or channel configuration.'
                )
              : t('No models match your current filters.')}
          </EmptyDescription>
        </EmptyHeader>
        {!scopeIsEmpty && (
          <EmptyContent>
            <Button variant='outline' size='sm' onClick={onClearFilters}>
              {t('Clear filters')}
            </Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }

  const visibleCount = getEffectiveVisibleCatalogCount(
    pagination,
    models,
    scopeIsEmpty
  )
  const visibleModels = models.slice(0, visibleCount)
  const hasMoreModels = visibleModels.length < models.length

  return (
    <TooltipProvider>
      <div className='flex flex-col gap-3'>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
          {visibleModels.map((model) => {
            const hasExclusiveRatio = Object.prototype.hasOwnProperty.call(
              modelRatios,
              model.id
            )
            const ratio = resolveCatalogPriceRatio({
              modelId: model.id,
              modelRatios,
              defaultRatio,
            })

            return (
              <ModelCatalogCard
                key={model.id}
                model={model}
                price={resolveCatalogPrice(priceIndex.get(model.id), { ratio })}
                exclusiveRatio={
                  hasExclusiveRatio ? modelRatios[model.id] : null
                }
                defaultRatio={defaultRatio}
              />
            )
          })}
        </div>
        {hasMoreModels && (
          <Button
            type='button'
            variant='outline'
            className='self-center'
            onClick={() =>
              setPagination({
                models,
                scopeIsEmpty,
                visibleCount: getNextVisibleCatalogCount(
                  visibleCount,
                  models.length
                ),
              })
            }
          >
            {t('More')}
          </Button>
        )}
      </div>
    </TooltipProvider>
  )
}
