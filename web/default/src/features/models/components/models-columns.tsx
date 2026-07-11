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
import { useTranslation } from 'react-i18next'

import { BadgeCell, BadgeListCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { ProviderBadge } from '@/components/provider-badge'
import { CopyableStatusBadge, StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatTimestampToDate } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  getModelStatusConfig,
  getNameRuleConfig,
  getQuotaTypeConfig,
} from '../constants'
import { parseModelTags, formatEndpointsDisplay } from '../lib'
import type { Model, Vendor } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { DescriptionCell } from './description-cell'

function getCompactModelIcon(iconKey: string) {
  const baseIconKey = iconKey.split('.')[0]

  return getLobeIcon(`${baseIconKey}.Avatar.type={'platform'}`, 20)
}

/**
 * Generate models columns configuration
 */
export function useModelsColumns(vendors: Vendor[] = []): ColumnDef<Model>[] {
  const { t } = useTranslation()

  // Get translated configs
  const NAME_RULE_CONFIG = getNameRuleConfig(t)
  const MODEL_STATUS_CONFIG = getModelStatusConfig(t)
  const QUOTA_TYPE_CONFIG = getQuotaTypeConfig(t)

  const vendorMap: Record<number, Vendor> = {}
  vendors.forEach((v) => {
    vendorMap[v.id] = v
  })

  return [
    // Checkbox column
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },

    // ID column
    {
      accessorKey: 'id',
      header: t('ID'),
      meta: {
        cardRole: 'secondary',
        cardOrder: 10,
        cardSpan: 2,
        contentMode: 'full',
      },
      cell: ({ row }) => {
        const id = row.getValue('id') as number
        return <TableId value={id} />
      },
      size: 80,
    },

    // Icon column
    {
      accessorKey: 'icon',
      header: t('Icon'),
      meta: { cardRole: 'hidden' },
      cell: ({ row }) => {
        const model = row.original
        const iconKey =
          model.icon ||
          vendorMap[model.vendor_id || 0]?.icon ||
          model.model_name?.[0] ||
          'N'
        const icon = getCompactModelIcon(iconKey)

        return (
          <div className='ms-1 flex size-5 items-center justify-center overflow-hidden'>
            {icon}
          </div>
        )
      },
      size: 70,
      enableSorting: false,
    },

    // Model Name column
    {
      accessorKey: 'model_name',
      header: t('Model Name'),
      meta: {
        cardRole: 'title',
        cardSpan: 2,
        contentMode: 'wrap',
      },
      cell: ({ row }) => {
        const name = row.getValue('model_name') as string
        return (
          <CopyableStatusBadge value={name} variant='neutral' size='sm'>
            {name}
          </CopyableStatusBadge>
        )
      },
      minSize: 200,
    },

    // Name Rule column
    {
      accessorKey: 'name_rule',
      header: t('Match Type'),
      cell: ({ row }) => {
        const rule = row.getValue('name_rule') as 0 | 1 | 2 | 3
        const model = row.original
        const config = NAME_RULE_CONFIG[rule]

        let label = config.label
        if (rule !== 0 && model.matched_count) {
          label = `${config.label} (${model.matched_count})`
        }

        const badge = (
          <StatusBadge variant={config.variant} size='sm'>
            {label}
          </StatusBadge>
        )

        // Show tooltip with matched models for non-exact rules
        if (
          rule !== 0 &&
          model.matched_models &&
          model.matched_models.length > 0
        ) {
          const matchedBadges = model.matched_models.map((m) => (
            <StatusBadge key={m} variant='neutral' size='sm'>
              {m}
            </StatusBadge>
          ))

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<div />}>{badge}</TooltipTrigger>
                <TooltipContent
                  side='top'
                  className='border-border bg-popover max-h-48 max-w-[320px] overflow-y-auto p-2'
                >
                  <div className='flex flex-wrap gap-1'>{matchedBadges}</div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        }

        return badge
      },
      size: 140,
      enableSorting: false,
      meta: {
        cardRole: 'primary',
        cardOrder: 10,
        contentMode: 'wrap',
      },
    },

    // Status column
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { cardRole: 'badge', contentMode: 'wrap' },
      cell: ({ row }) => {
        const status = row.getValue('status') as number
        const config =
          MODEL_STATUS_CONFIG[status as 0 | 1] || MODEL_STATUS_CONFIG[0]

        return (
          <StatusBadge variant={config.variant} size='sm'>
            {config.label}
          </StatusBadge>
        )
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0 || value.includes('all')) return true
        const status = row.getValue(id) as number
        if (value.includes('enabled')) return status === 1
        if (value.includes('disabled')) return status !== 1
        return false
      },
      size: 120,
      enableSorting: false,
    },

    // Vendor column
    {
      accessorKey: 'vendor_id',
      header: t('Vendor'),
      cell: ({ row }) => {
        const vendorId = row.getValue('vendor_id') as number
        const vendor = vendorMap[vendorId]

        if (!vendor) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        return (
          <BadgeCell className='overflow-visible'>
            <ProviderBadge iconKey={vendor.icon} label={vendor.name} />
          </BadgeCell>
        )
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0 || value.includes('all')) return true
        return value.includes(String(row.getValue(id)))
      },
      size: 150,
      enableSorting: false,
      meta: {
        cardRole: 'primary',
        cardOrder: 20,
        cardSpan: 2,
        contentMode: 'wrap',
      },
    },

    // Description column
    {
      accessorKey: 'description',
      header: t('Description'),
      meta: {
        cardRole: 'secondary',
        cardOrder: 20,
        cardSpan: 2,
        contentMode: 'summary',
      },
      cell: ({ row }) => {
        const description = row.getValue('description') as string
        const modelName = row.getValue('model_name') as string

        return (
          <DescriptionCell modelName={modelName} description={description} />
        )
      },
      size: 150,
      enableSorting: false,
    },

    // Tags column
    {
      accessorKey: 'tags',
      header: t('Tags'),
      meta: {
        cardRole: 'secondary',
        cardOrder: 30,
        cardSpan: 2,
        contentMode: 'summary',
      },
      cell: ({ row }) => {
        const tags = row.getValue('tags') as string
        const tagArray = parseModelTags(tags)
        return (
          <BadgeListCell
            items={tagArray.map((tag) => (
              <StatusBadge key={tag} variant='neutral' size='sm'>
                {tag}
              </StatusBadge>
            ))}
          />
        )
      },
      size: 150,
      enableSorting: false,
    },

    // Endpoints column
    {
      accessorKey: 'endpoints',
      header: t('Endpoints'),
      meta: {
        cardRole: 'secondary',
        cardOrder: 40,
        cardSpan: 2,
        contentMode: 'summary',
      },
      cell: ({ row }) => {
        const endpoints = row.getValue('endpoints') as string
        const endpointArray = formatEndpointsDisplay(endpoints)
        return (
          <BadgeListCell
            items={endpointArray.map((ep) => (
              <StatusBadge key={ep} variant='neutral' size='sm'>
                {ep}
              </StatusBadge>
            ))}
          />
        )
      },
      size: 150,
      enableSorting: false,
    },

    // Bound Channels column
    {
      accessorKey: 'bound_channels',
      header: t('Bound Channels'),
      meta: {
        cardRole: 'secondary',
        cardOrder: 50,
        cardSpan: 2,
        contentMode: 'summary',
      },
      cell: ({ row }) => {
        const channels = row.getValue('bound_channels') as Array<{
          id: number
          name: string
          type?: number
          status?: number
        }>
        return (
          <BadgeListCell
            items={(channels ?? []).map((c) => (
              <StatusBadge
                key={`${c.id}-${c.name}-${c.type ?? ''}`}
                variant='neutral'
                size='sm'
              >
                {`${c.name} (${c.type})`}
              </StatusBadge>
            ))}
          />
        )
      },
      size: 150,
      enableSorting: false,
    },

    // Enable Groups column
    {
      accessorKey: 'enable_groups',
      header: t('Enable Groups'),
      meta: {
        cardRole: 'secondary',
        cardOrder: 60,
        cardSpan: 2,
        contentMode: 'summary',
      },
      cell: ({ row }) => {
        const groups = row.getValue('enable_groups') as string[]
        return (
          <BadgeListCell
            items={(groups ?? []).map((g) => (
              <GroupBadge key={g} group={g} size='sm' />
            ))}
          />
        )
      },
      size: 150,
      enableSorting: false,
    },

    // Quota Types column
    {
      accessorKey: 'quota_types',
      header: t('Quota Types'),
      meta: {
        cardRole: 'secondary',
        cardOrder: 70,
        cardSpan: 2,
        contentMode: 'summary',
      },
      cell: ({ row }) => {
        const quotaTypes = row.getValue('quota_types') as number[]
        return (
          <BadgeListCell
            items={(quotaTypes ?? []).map((qt) => {
              const config = QUOTA_TYPE_CONFIG[qt]
              return (
                <StatusBadge
                  key={qt}
                  variant={config?.variant || 'neutral'}
                  size='sm'
                >
                  {config?.label || String(qt)}
                </StatusBadge>
              )
            })}
          />
        )
      },
      size: 150,
      enableSorting: false,
    },

    // Sync Official column
    {
      accessorKey: 'sync_official',
      header: t('Official Sync'),
      meta: {
        cardRole: 'secondary',
        cardOrder: 80,
        contentMode: 'wrap',
      },
      cell: ({ row }) => {
        const syncOfficial = row.getValue('sync_official') as number
        return (
          <StatusBadge
            variant={syncOfficial === 1 ? 'success' : 'warning'}
            size='sm'
          >
            {syncOfficial === 1 ? t('Official Sync') : t('No Sync')}
          </StatusBadge>
        )
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0 || value.includes('all')) return true
        const syncOfficial = row.getValue(id) as number
        if (value.includes('yes')) return syncOfficial === 1
        if (value.includes('no')) return syncOfficial !== 1
        return false
      },
      size: 120,
      enableSorting: false,
    },

    // Created Time column
    {
      accessorKey: 'created_time',
      header: t('Created'),
      meta: {
        cardRole: 'secondary',
        cardOrder: 90,
        contentMode: 'full',
      },
      cell: ({ row }) => {
        const timestamp = row.getValue('created_time') as number
        return (
          <div className='min-w-[140px] font-mono text-sm'>
            {formatTimestampToDate(timestamp)}
          </div>
        )
      },
      size: 180,
    },

    // Updated Time column
    {
      accessorKey: 'updated_time',
      header: t('Updated'),
      meta: {
        cardRole: 'secondary',
        cardOrder: 100,
        contentMode: 'full',
      },
      cell: ({ row }) => {
        const timestamp = row.getValue('updated_time') as number
        return (
          <div className='min-w-[140px] font-mono text-sm'>
            {formatTimestampToDate(timestamp)}
          </div>
        )
      },
      size: 180,
    },

    // Actions column
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => {
        return <DataTableRowActions row={row} />
      },
      enableSorting: false,
      enableHiding: false,
      meta: { pinned: 'right' as const },
    },
  ]
}
