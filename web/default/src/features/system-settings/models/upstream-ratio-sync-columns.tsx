import { type ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, CheckCircle } from 'lucide-react'
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

export type DifferenceRow = {
  key: string
  model: string
  ratioType: RatioType
  current: number | null
  upstreams: Record<string, number | 'same'>
  confidence: Record<string, boolean>
  billingConflict: boolean
}

type ResolutionsMap = Record<string, Record<RatioType, number>>

export function useUpstreamRatioSyncColumns(
  upstreamNames: string[],
  resolutions: ResolutionsMap,
  onSelectValue: (model: string, ratioType: RatioType, value: number) => void,
  onUnselectValue: (model: string, ratioType: RatioType) => void,
  onBulkSelect: (upstreamName: string, rows: DifferenceRow[]) => void,
  onBulkUnselect: (upstreamName: string, rows: DifferenceRow[]) => void
): ColumnDef<DifferenceRow>[] {
  const { t } = useTranslation()
  const baseColumns: ColumnDef<DifferenceRow>[] = [
    {
      accessorKey: 'model',
      header: t('Model'),
      cell: ({ row }) => {
        const model = row.getValue('model') as string
        return (
          <StatusBadge
            label={model}
            autoColor={model}
            copyText={model}
            size='sm'
            className='font-mono'
          />
        )
      },
    },
    {
      accessorKey: 'ratioType',
      header: t('Ratio Type'),
      cell: ({ row }) => {
        const ratioType = row.getValue('ratioType') as RatioType
        const billingConflict = row.original.billingConflict

        const config = RATIO_TYPE_OPTIONS.find((opt) => opt.value === ratioType)
        const label = config?.label || ratioType

        const badge = (
          <StatusBadge
            label={label}
            autoColor={ratioType}
            size='sm'
            copyable={false}
          />
        )

        if (billingConflict) {
          return (
            <TooltipProvider>
              <div className='flex items-center gap-1.5'>
                {badge}
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className='h-3.5 w-3.5 text-amber-500' />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {t(
                        'This model has both fixed price and ratio billing conflicts'
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )
        }

        return badge
      },
    },
    {
      id: 'confidence',
      header: t('Confidence'),
      cell: ({ row }) => {
        const confidence = row.original.confidence
        const allConfident = Object.values(confidence).every((v) => v !== false)

        if (allConfident) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <StatusBadge
                    label={t('Trusted')}
                    variant='success'
                    size='sm'
                    copyable={false}
                    icon={CheckCircle}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('All upstream data is trusted')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        }

        const untrustedSources = Object.entries(confidence)
          .filter(([_, isConfident]) => isConfident === false)
          .map(([name]) => name)
          .join(', ')

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <StatusBadge
                  label={t('Caution')}
                  variant='warning'
                  size='sm'
                  copyable={false}
                  icon={AlertTriangle}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {t('Untrusted upstream data:')} {untrustedSources}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      accessorKey: 'current',
      header: t('Current Value'),
      cell: ({ row }) => {
        const current = row.getValue('current') as number | null
        return (
          <StatusBadge
            label={current !== null ? String(current) : 'Not Set'}
            variant={current !== null ? 'info' : 'neutral'}
            size='sm'
            copyable={false}
          />
        )
      },
    },
  ]

  const upstreamColumns: ColumnDef<DifferenceRow>[] = upstreamNames.map(
    (upstreamName) => ({
      id: `upstream_${upstreamName}`,
      header: ({ table }) => {
        const rows = table.getFilteredRowModel().rows.map((r) => r.original)

        const selectableRows = rows.filter((row) => {
          const value = row.upstreams[upstreamName]
          return value !== null && value !== undefined && value !== 'same'
        })

        if (selectableRows.length === 0) {
          return <span className='font-medium'>{upstreamName}</span>
        }

        const selectedCount = selectableRows.filter((row) => {
          const value = row.upstreams[upstreamName]
          return (
            typeof value === 'number' &&
            resolutions[row.model]?.[row.ratioType] === value
          )
        }).length

        const allSelected =
          selectedCount > 0 && selectedCount === selectableRows.length
        const someSelected =
          selectedCount > 0 && selectedCount < selectableRows.length

        return (
          <div className='flex items-center gap-2'>
            <Checkbox
              checked={
                allSelected ? true : someSelected ? 'indeterminate' : false
              }
              onCheckedChange={(checked) => {
                if (checked) {
                  onBulkSelect(upstreamName, selectableRows)
                } else {
                  onBulkUnselect(upstreamName, selectableRows)
                }
              }}
            />
            <span className='font-medium'>{upstreamName}</span>
          </div>
        )
      },
      cell: ({ row }) => {
        const upstreamValue = row.original.upstreams[upstreamName]
        const isConfident = row.original.confidence[upstreamName] !== false

        if (upstreamValue === null || upstreamValue === undefined) {
          return (
            <StatusBadge
              label={t('Not Set')}
              variant='neutral'
              size='sm'
              copyable={false}
            />
          )
        }

        if (upstreamValue === 'same') {
          return (
            <StatusBadge
              label={t('Same as Local')}
              variant='info'
              size='sm'
              copyable={false}
            />
          )
        }

        const isSelected =
          resolutions[row.original.model]?.[row.original.ratioType] ===
          upstreamValue

        return (
          <div className='flex items-center gap-2'>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                if (checked) {
                  onSelectValue(
                    row.original.model,
                    row.original.ratioType,
                    upstreamValue as number
                  )
                } else {
                  onUnselectValue(row.original.model, row.original.ratioType)
                }
              }}
            />
            <span className='font-mono text-sm'>{upstreamValue}</span>
            {!isConfident && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className='h-3.5 w-3.5 text-amber-500' />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('This data may be unreliable, use with caution')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )
      },
    })
  )

  return [...baseColumns, ...upstreamColumns]
}
