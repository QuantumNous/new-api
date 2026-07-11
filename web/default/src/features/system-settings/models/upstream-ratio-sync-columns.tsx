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
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import type { RatioType } from '../types'
import {
  getAlignedRatioTypes,
  getPreferredSyncField,
  getSyncFieldLabel,
  isSelectedResolutionValue,
  type ModelRow,
  type ResolutionsMap,
} from './upstream-ratio-sync-helpers'
import type { UpstreamBulkSelectState } from './upstream-ratio-sync-table'

const syncFieldListClassName = 'flex max-w-full min-w-0 flex-col gap-1.5'
const syncFieldRowClassName =
  'bg-muted/30 flex h-8 w-fit max-w-full min-w-0 items-center gap-2 rounded-md px-2'
const syncFieldLabelClassName = 'min-w-[4.5rem] shrink-0'

export function useUpstreamRatioSyncColumns(
  upstreamNames: string[],
  bulkSelectStateByUpstream: Record<string, UpstreamBulkSelectState>,
  resolutions: ResolutionsMap,
  ratioTypeFilter: string,
  isDisabled: boolean,
  onSelectValue: (
    model: string,
    ratioType: RatioType,
    value: number | string,
    sourceName: string
  ) => void,
  onUnselectValue: (model: string, ratioType: RatioType) => void,
  onBulkSelect: (upstreamName: string) => void,
  onBulkUnselect: (upstreamName: string) => void
): ColumnDef<ModelRow>[] {
  const { t } = useTranslation()

  return useMemo<ColumnDef<ModelRow>[]>(() => {
    const baseColumns: ColumnDef<ModelRow>[] = [
      {
        accessorKey: 'model',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Model')} />
        ),
        size: 220,
        minSize: 180,
        cell: ({ row }) => {
          const model = row.original.model
          return (
            <div className='flex max-w-full min-w-0 items-center gap-2'>
              <span className='truncate font-medium'>{model}</span>
              {row.original.billingConflict && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className='text-warning h-3.5 w-3.5 shrink-0' />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {t(
                          'This model has both fixed price and ratio billing conflicts'
                        )}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )
        },
      },
      {
        id: 'current',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Current Price')} />
        ),
        size: 260,
        minSize: 220,
        cell: ({ row }) => {
          const fields = getAlignedRatioTypes(
            row.original.ratioTypes,
            upstreamNames,
            ratioTypeFilter
          )
          return (
            <div className={syncFieldListClassName}>
              {fields.map((ratioType) => {
                const current = row.original.ratioTypes[ratioType]?.current
                return (
                  <div key={ratioType} className={syncFieldRowClassName}>
                    <StatusBadge
                      variant='neutral'
                      size='sm'
                      className={syncFieldLabelClassName}
                    >
                      {getSyncFieldLabel(ratioType, t)}
                    </StatusBadge>
                    {current === null || current === undefined ? (
                      <StatusBadge variant='neutral' size='sm'>
                        {t('Not Set')}
                      </StatusBadge>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <StatusBadge
                                variant='info'
                                size='sm'
                                className='max-w-[160px]'
                              />
                            }
                          >
                            {String(current)}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className='max-w-xs text-xs break-all'>
                              {String(current)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )
              })}
            </div>
          )
        },
      },
    ]

    const upstreamColumns: ColumnDef<ModelRow>[] = upstreamNames.map(
      (upstreamName) => ({
        id: `upstream_${upstreamName}`,
        size: 280,
        minSize: 240,
        header: () => {
          const bulkSelectState = bulkSelectStateByUpstream[upstreamName]
          const displayName = bulkSelectState?.displayName ?? upstreamName
          const selectableCount = bulkSelectState?.selectableCount ?? 0
          const selectedCount = bulkSelectState?.selectedCount ?? 0
          const allSelected =
            selectableCount > 0 && selectedCount === selectableCount
          const someSelected =
            selectedCount > 0 && selectedCount < selectableCount
          return (
            <div className='flex h-9 min-w-0 items-center gap-1.5'>
              {selectableCount > 0 && (
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={isDisabled}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onBulkSelect(upstreamName)
                    } else {
                      onBulkUnselect(upstreamName)
                    }
                  }}
                  aria-label={t('Select all (filtered)')}
                  className='shrink-0'
                />
              )}
              <div className='flex min-w-0 flex-1 items-center gap-1.5'>
                <span className='min-w-0 truncate font-medium'>
                  {displayName}
                </span>
                {selectableCount > 0 && (
                  <span className='bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-xs leading-none font-normal tabular-nums'>
                    {selectedCount}/{selectableCount}
                  </span>
                )}
              </div>
            </div>
          )
        },
        cell: ({ row }) => {
          const fields = getAlignedRatioTypes(
            row.original.ratioTypes,
            upstreamNames,
            ratioTypeFilter
          )

          return (
            <div className={syncFieldListClassName}>
              {fields.map((ratioType) => {
                const diff = row.original.ratioTypes[ratioType]
                const upstreamVal = diff?.upstreams?.[upstreamName]
                const isConfident = diff?.confidence?.[upstreamName] !== false
                const isVisibleForSource =
                  getPreferredSyncField(
                    row.original.ratioTypes,
                    ratioType,
                    upstreamName
                  ) === ratioType

                return (
                  <div key={ratioType} className={syncFieldRowClassName}>
                    <StatusBadge
                      variant='neutral'
                      size='sm'
                      className={syncFieldLabelClassName}
                    >
                      {getSyncFieldLabel(ratioType, t)}
                    </StatusBadge>
                    <div className='min-w-0 flex-1'>
                      {renderUpstreamValue({
                        upstreamVal,
                        isAvailable: isVisibleForSource,
                        isConfident,
                        isSelected: isSelectedResolutionValue(
                          resolutions,
                          row.original.model,
                          ratioType,
                          upstreamVal
                        ),
                        isDisabled,
                        t,
                        onSelect: () =>
                          onSelectValue(
                            row.original.model,
                            ratioType,
                            upstreamVal as number | string,
                            upstreamName
                          ),
                        onUnselect: () =>
                          onUnselectValue(row.original.model, ratioType),
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        },
      })
    )

    return [...baseColumns, ...upstreamColumns]
  }, [
    upstreamNames,
    bulkSelectStateByUpstream,
    resolutions,
    ratioTypeFilter,
    isDisabled,
    onSelectValue,
    onUnselectValue,
    onBulkSelect,
    onBulkUnselect,
    t,
  ])
}

type RenderUpstreamValueArgs = {
  upstreamVal: number | string | 'same' | null | undefined
  isAvailable: boolean
  isConfident: boolean
  isSelected: boolean
  isDisabled: boolean
  t: (key: string) => string
  onSelect: () => void
  onUnselect: () => void
}

function renderUpstreamValue(args: RenderUpstreamValueArgs) {
  const { upstreamVal, isAvailable, isConfident, isSelected, isDisabled, t } =
    args

  if (!isAvailable) {
    return (
      <StatusBadge variant='neutral' size='sm'>
        —
      </StatusBadge>
    )
  }

  if (upstreamVal === null || upstreamVal === undefined) {
    return (
      <StatusBadge variant='neutral' size='sm'>
        {t('Not Set')}
      </StatusBadge>
    )
  }

  if (upstreamVal === 'same') {
    return (
      <StatusBadge variant='info' size='sm'>
        {t('Same as Local')}
      </StatusBadge>
    )
  }

  const text = String(upstreamVal)

  return (
    <div className='flex h-full min-w-0 items-center gap-2'>
      <Checkbox
        checked={isSelected}
        disabled={isDisabled}
        onCheckedChange={(checked) => {
          if (checked) {
            args.onSelect()
          } else {
            args.onUnselect()
          }
        }}
        className='size-4'
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className='inline-block max-w-[240px] cursor-default truncate font-mono text-sm' />
            }
          >
            {text}
          </TooltipTrigger>
          <TooltipContent>
            <p className='max-w-xs text-xs break-all'>{text}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {!isConfident && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <AlertTriangle className='text-warning h-3.5 w-3.5 shrink-0' />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('This data may be unreliable, use with caution')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
