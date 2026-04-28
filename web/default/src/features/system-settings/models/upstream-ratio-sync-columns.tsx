import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/status-badge'
import type { RatioType } from '../types'
import {
  getOrderedRatioTypes,
  getPreferredSyncField,
  getSyncFieldLabel,
  isSelectableUpstreamValue,
  type ModelRow,
  type ResolutionsMap,
} from './upstream-ratio-sync-helpers'

export function useUpstreamRatioSyncColumns(
  upstreamNames: string[],
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
  onBulkSelect: (upstreamName: string, rows: ModelRow[]) => void,
  onBulkUnselect: (upstreamName: string, rows: ModelRow[]) => void
): ColumnDef<ModelRow>[] {
  const { t } = useTranslation()

  return useMemo<ColumnDef<ModelRow>[]>(() => {
    const baseColumns: ColumnDef<ModelRow>[] = [
      {
        accessorKey: 'model',
        header: t('Model'),
        cell: ({ row }) => {
          const model = row.original.model
          return (
            <div className='flex min-w-[180px] items-center gap-2'>
              <span className='font-medium'>{model}</span>
              {row.original.billingConflict && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className='h-3.5 w-3.5 shrink-0 text-amber-500' />
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
        header: t('Current Price'),
        cell: ({ row }) => {
          const fields = getOrderedRatioTypes(
            row.original.ratioTypes,
            ratioTypeFilter
          )
          return (
            <div className='flex min-w-[260px] flex-col gap-2'>
              {fields.map((ratioType) => {
                const current = row.original.ratioTypes[ratioType]?.current
                return (
                  <div
                    key={ratioType}
                    className='flex min-w-0 flex-wrap items-center gap-2'
                  >
                    <StatusBadge
                      label={getSyncFieldLabel(ratioType, t)}
                      autoColor={ratioType}
                      size='sm'
                      copyable={false}
                    />
                    {current === null || current === undefined ? (
                      <StatusBadge
                        label={t('Not Set')}
                        variant='neutral'
                        size='sm'
                        copyable={false}
                      />
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <StatusBadge
                              label={String(current)}
                              variant='info'
                              size='sm'
                              className='max-w-[200px] truncate'
                            />
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
        header: ({ table }) => {
          const rows = table.getFilteredRowModel().rows.map((r) => r.original)

          let selectableCount = 0
          let selectedCount = 0

          rows.forEach((row) => {
            getOrderedRatioTypes(row.ratioTypes, ratioTypeFilter).forEach(
              (ratioType) => {
                const upstreamVal =
                  row.ratioTypes[ratioType]?.upstreams?.[upstreamName]
                const preferredField = getPreferredSyncField(
                  row.ratioTypes,
                  ratioType,
                  upstreamName
                )
                if (
                  preferredField === ratioType &&
                  isSelectableUpstreamValue(upstreamVal)
                ) {
                  selectableCount++
                  if (resolutions[row.model]?.[ratioType] === upstreamVal) {
                    selectedCount++
                  }
                }
              }
            )
          })

          const allSelected =
            selectableCount > 0 && selectedCount === selectableCount
          const someSelected =
            selectedCount > 0 && selectedCount < selectableCount
          let checkboxState: boolean | 'indeterminate' = false
          if (allSelected) checkboxState = true
          else if (someSelected) checkboxState = 'indeterminate'

          return (
            <div className='flex items-center gap-2'>
              {selectableCount > 0 && (
                <Checkbox
                  checked={checkboxState}
                  disabled={isDisabled}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onBulkSelect(upstreamName, rows)
                    } else {
                      onBulkUnselect(upstreamName, rows)
                    }
                  }}
                />
              )}
              <span className='font-medium'>{upstreamName}</span>
            </div>
          )
        },
        cell: ({ row }) => {
          const fields = getOrderedRatioTypes(
            row.original.ratioTypes,
            ratioTypeFilter
          ).filter(
            (ratioType) =>
              getPreferredSyncField(
                row.original.ratioTypes,
                ratioType,
                upstreamName
              ) === ratioType
          )

          return (
            <div className='flex min-w-[280px] flex-col gap-2'>
              {fields.map((ratioType) => {
                const diff = row.original.ratioTypes[ratioType]
                const upstreamVal = diff?.upstreams?.[upstreamName]
                const isConfident = diff?.confidence?.[upstreamName] !== false

                return (
                  <div
                    key={ratioType}
                    className='flex min-w-0 items-start gap-2'
                  >
                    <StatusBadge
                      label={getSyncFieldLabel(ratioType, t)}
                      autoColor={ratioType}
                      size='sm'
                      copyable={false}
                      className='shrink-0'
                    />
                    <div className='min-w-0 flex-1'>
                      {renderUpstreamValue({
                        upstreamVal,
                        isConfident,
                        isSelected:
                          resolutions[row.original.model]?.[ratioType] ===
                          upstreamVal,
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
  isConfident: boolean
  isSelected: boolean
  isDisabled: boolean
  t: (key: string) => string
  onSelect: () => void
  onUnselect: () => void
}

function renderUpstreamValue(args: RenderUpstreamValueArgs) {
  const { upstreamVal, isConfident, isSelected, isDisabled, t } = args

  if (upstreamVal === null || upstreamVal === undefined) {
    return (
      <StatusBadge
        label={t('Not Set')}
        variant='neutral'
        size='sm'
        copyable={false}
      />
    )
  }

  if (upstreamVal === 'same') {
    return (
      <StatusBadge
        label={t('Same as Local')}
        variant='info'
        size='sm'
        copyable={false}
      />
    )
  }

  const text = String(upstreamVal)

  return (
    <div className='flex min-w-0 items-center gap-2'>
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
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className='inline-block max-w-[240px] cursor-default truncate font-mono text-sm'>
              {text}
            </span>
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
              <AlertTriangle className='h-3.5 w-3.5 shrink-0 text-amber-500' />
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
