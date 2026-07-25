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
import {
  Alert02Icon,
  Copy01Icon,
  PackageIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { getModelAvailabilityConfig } from '@/lib/model-availability'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/status-badge'
import {
  getModelEndpointLabel,
  normalizeModelAvailabilityStatus,
} from '../lib/model-access-browser'
import type { ModelAccessModel } from '../types'

type ModelAccessListProps = {
  defaultRatio: number | null
  modelRatios: Readonly<Record<string, number>>
  models: ModelAccessModel[]
  scopeIsEmpty: boolean
  onClearFilters: () => void
}

export const MODEL_ACCESS_PAGE_SIZE = 50

type ModelAccessPaginationState = {
  models: ModelAccessModel[]
  scopeIsEmpty: boolean
  visibleCount: number
}

// eslint-disable-next-line react-refresh/only-export-components
export function getNextVisibleModelCount(
  currentCount: number,
  totalCount: number
): number {
  return Math.min(currentCount + MODEL_ACCESS_PAGE_SIZE, totalCount)
}

// eslint-disable-next-line react-refresh/only-export-components
export function getEffectiveVisibleModelCount(
  pagination: ModelAccessPaginationState,
  models: ModelAccessModel[],
  scopeIsEmpty: boolean
): number {
  if (
    pagination.models !== models ||
    pagination.scopeIsEmpty !== scopeIsEmpty
  ) {
    return MODEL_ACCESS_PAGE_SIZE
  }
  return pagination.visibleCount
}

export function ModelAccessList({
  defaultRatio,
  modelRatios,
  models,
  scopeIsEmpty,
  onClearFilters,
}: ModelAccessListProps) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const availability = getModelAvailabilityConfig(t)
  const [pagination, setPagination] = useState<ModelAccessPaginationState>(
    () => ({
      models,
      scopeIsEmpty,
      visibleCount: MODEL_ACCESS_PAGE_SIZE,
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
          {scopeIsEmpty && (
            <EmptyDescription>
              {t(
                'No models are available in the current scope. Contact your administrator to check model or channel configuration.'
              )}
            </EmptyDescription>
          )}
          {!scopeIsEmpty && (
            <EmptyDescription>
              {t('No models match your current filters.')}
            </EmptyDescription>
          )}
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

  const visibleCount = getEffectiveVisibleModelCount(
    pagination,
    models,
    scopeIsEmpty
  )
  const visibleModels = models.slice(0, visibleCount)
  const hasMoreModels = visibleModels.length < models.length

  return (
    <TooltipProvider>
      <div className='flex flex-col gap-3'>
        <ItemGroup className='gap-2.5'>
          {visibleModels.map((model) => {
            const officiallyUnsupported =
              model.availability_status === 'official_unsupported'
            const availabilityConfig =
              availability[
                normalizeModelAvailabilityStatus(model.availability_status)
              ] || availability.unknown_failure
            const endpointLabels = Array.from(
              new Set(
                model.supported_endpoint_types.map((endpoint) =>
                  getModelEndpointLabel(endpoint, t)
                )
              )
            )
            const hasExclusiveRatio = Object.prototype.hasOwnProperty.call(
              modelRatios,
              model.id
            )
            const exclusiveRatio = modelRatios[model.id]
            const exclusiveRatioLabel = hasExclusiveRatio
              ? t('Exclusive ratio {{ratio}}×', { ratio: exclusiveRatio })
              : ''
            let exclusiveRatioDescription = ''
            if (hasExclusiveRatio && officiallyUnsupported) {
              exclusiveRatioDescription =
                defaultRatio === null
                  ? t(
                      'If this model becomes callable again, it will use the exclusive ratio {{ratio}}×, overriding the default ratio; the two are not multiplied.',
                      { ratio: exclusiveRatio }
                    )
                  : t(
                      'If this model becomes callable again, it will use the exclusive ratio {{ratio}}×, overriding the default ratio {{defaultRatio}}×; the two are not multiplied.',
                      { ratio: exclusiveRatio, defaultRatio }
                    )
            } else if (hasExclusiveRatio) {
              exclusiveRatioDescription =
                defaultRatio === null
                  ? t(
                      'This exclusive ratio overrides the default ratio; the two are not multiplied.'
                    )
                  : t(
                      'This exclusive ratio overrides the default ratio {{defaultRatio}}×; the two are not multiplied.',
                      { defaultRatio }
                    )
            }

            return (
              <Item
                key={model.id}
                variant='outline'
                size='sm'
                className={cn(
                  officiallyUnsupported &&
                    'border-destructive/40 bg-destructive/5'
                )}
              >
                <ItemMedia variant='icon'>
                  {getLobeIcon(model.vendor?.icon, 18)}
                </ItemMedia>
                <ItemContent className='min-w-0'>
                  <ItemTitle className='max-w-full font-mono'>
                    <span className='truncate'>{model.id}</span>
                  </ItemTitle>
                  <ItemDescription>
                    {model.vendor?.name ?? t('Unknown')}
                  </ItemDescription>
                  {officiallyUnsupported && (
                    <p className='text-destructive text-xs font-medium'>
                      {t(
                        'This model cannot be called because upstreams no longer support it.'
                      )}
                    </p>
                  )}
                </ItemContent>
                <ItemActions>
                  {officiallyUnsupported ? (
                    <Badge variant='destructive'>
                      <HugeiconsIcon
                        icon={Alert02Icon}
                        strokeWidth={2}
                        data-icon='inline-start'
                        aria-hidden='true'
                      />
                      {t('Not callable · Officially unsupported')}
                    </Badge>
                  ) : (
                    <StatusBadge
                      label={availabilityConfig.label}
                      variant={availabilityConfig.variant}
                      copyable={false}
                    />
                  )}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type='button'
                          size='icon-sm'
                          variant='ghost'
                          aria-label={t('Copy to clipboard')}
                          onClick={() => void copyToClipboard(model.id)}
                        />
                      }
                    >
                      <HugeiconsIcon
                        icon={Copy01Icon}
                        strokeWidth={2}
                        aria-hidden='true'
                      />
                    </TooltipTrigger>
                    <TooltipContent>{t('Copy to clipboard')}</TooltipContent>
                  </Tooltip>
                </ItemActions>
                <ItemFooter className='justify-start'>
                  <div className='flex flex-wrap gap-1.5'>
                    {hasExclusiveRatio && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Badge
                              variant='outline'
                              className='border-warning bg-warning text-warning-foreground font-semibold'
                              tabIndex={0}
                              aria-label={`${exclusiveRatioLabel}. ${exclusiveRatioDescription}`}
                            />
                          }
                        >
                          {exclusiveRatioLabel}
                        </TooltipTrigger>
                        <TooltipContent>
                          {exclusiveRatioDescription}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {endpointLabels.length > 0 ? (
                      endpointLabels.map((endpoint) => (
                        <Badge key={endpoint} variant='outline'>
                          {endpoint}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant='outline'>
                        {t('Endpoint not specified')}
                      </Badge>
                    )}
                  </div>
                </ItemFooter>
              </Item>
            )
          })}
        </ItemGroup>
        {hasMoreModels && (
          <Button
            type='button'
            variant='outline'
            className='self-center'
            onClick={() =>
              setPagination({
                models,
                scopeIsEmpty,
                visibleCount: getNextVisibleModelCount(
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
