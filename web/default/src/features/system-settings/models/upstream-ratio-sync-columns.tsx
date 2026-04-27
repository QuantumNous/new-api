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
import { RATIO_TYPE_OPTIONS } from './constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RatioDifferenceEntry = {
  current: number | string | null
  upstreams: Record<string, number | string | 'same'>
  confidence: Record<string, boolean>
}

export type ModelRow = {
  key: string
  model: string
  ratioTypes: Partial<Record<RatioType, RatioDifferenceEntry>>
  billingConflict: boolean
}

export type ResolutionsMap = Record<string, Record<string, number | string>>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RATIO_SYNC_FIELDS: RatioType[] = [
  'model_ratio',
  'completion_ratio',
  'cache_ratio',
  'create_cache_ratio',
  'image_ratio',
  'audio_ratio',
  'audio_completion_ratio',
]

const SYNC_FIELD_ORDER: RatioType[] = [
  ...RATIO_SYNC_FIELDS,
  'model_price',
  'billing_mode',
  'billing_expr',
]

const NUMERIC_SYNC_FIELDS = new Set<string>([
  ...RATIO_SYNC_FIELDS,
  'model_price',
])

export function getSyncFieldLabel(
  ratioType: string,
  t: (key: string) => string
): string {
  const opt = RATIO_TYPE_OPTIONS.find((o) => o.value === ratioType)
  if (opt) return t(opt.label)
  return ratioType
}

export function getOrderedRatioTypes(
  ratioTypes: Partial<Record<RatioType, RatioDifferenceEntry>>,
  filter?: string
): RatioType[] {
  const keys = Object.keys(ratioTypes) as RatioType[]
  const ordered = [
    ...SYNC_FIELD_ORDER.filter((f) => keys.includes(f)),
    ...keys.filter((f) => !SYNC_FIELD_ORDER.includes(f)),
  ]
  return filter ? ordered.filter((f) => f === filter) : ordered
}

export function getPreferredSyncField(
  ratioTypes: Partial<Record<RatioType, RatioDifferenceEntry>>,
  ratioType: RatioType,
  sourceName: string
): RatioType {
  const exprValue = ratioTypes.billing_expr?.upstreams?.[sourceName]
  if (
    ratioType !== 'billing_expr' &&
    exprValue !== null &&
    exprValue !== undefined &&
    exprValue !== 'same'
  ) {
    return 'billing_expr'
  }
  return ratioType
}

export function isSelectableUpstreamValue(
  value: number | string | 'same' | null | undefined
): boolean {
  return value !== null && value !== undefined && value !== 'same'
}

export { RATIO_SYNC_FIELDS, NUMERIC_SYNC_FIELDS }

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

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
            {fields.map((ratioType) => (
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
                {(() => {
                  const current = row.original.ratioTypes[ratioType]?.current
                  if (current === null || current === undefined) {
                    return (
                      <StatusBadge
                        label={t('Not Set')}
                        variant='neutral'
                        size='sm'
                        copyable={false}
                      />
                    )
                  }
                  const text = String(current)
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <StatusBadge
                            label={text}
                            variant='info'
                            size='sm'
                            className='max-w-[200px] truncate'
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className='max-w-xs text-xs break-all'>{text}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                })()}
              </div>
            ))}
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

        return (
          <div className='flex items-center gap-2'>
            {selectableCount > 0 && (
              <Checkbox
                checked={
                  allSelected ? true : someSelected ? 'indeterminate' : false
                }
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
                <div key={ratioType} className='flex min-w-0 items-start gap-2'>
                  <StatusBadge
                    label={getSyncFieldLabel(ratioType, t)}
                    autoColor={ratioType}
                    size='sm'
                    copyable={false}
                    className='shrink-0'
                  />
                  <div className='min-w-0 flex-1'>
                    {(() => {
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
                      const isSelected =
                        resolutions[row.original.model]?.[ratioType] ===
                        upstreamVal

                      return (
                        <div className='flex min-w-0 items-center gap-2'>
                          <Checkbox
                            checked={isSelected}
                            disabled={isDisabled}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                onSelectValue(
                                  row.original.model,
                                  ratioType,
                                  upstreamVal,
                                  upstreamName
                                )
                              } else {
                                onUnselectValue(row.original.model, ratioType)
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
                                <p className='max-w-xs text-xs break-all'>
                                  {text}
                                </p>
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
                                  <p>
                                    {t(
                                      'This data may be unreliable, use with caution'
                                    )}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      )
                    })()}
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
}
