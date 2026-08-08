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
*/
import type { Table as TanstackTable } from '@tanstack/react-table'
import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

import { REGION_ROUTE_STRATEGY_CONFIG } from '../constants'
import type { RegionRoute } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

interface RegionRoutesMobileListProps {
  table: TanstackTable<RegionRoute>
  isLoading: boolean
}

const MOBILE_SKELETON_KEYS = [
  'region-route-mobile-skeleton-1',
  'region-route-mobile-skeleton-2',
  'region-route-mobile-skeleton-3',
]

function RegionRoutesMobileSkeleton() {
  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {MOBILE_SKELETON_KEYS.map((key) => (
        <div
          key={key}
          className='space-y-2 border-b px-3 py-2.5 last:border-b-0'
        >
          <div className='flex items-center justify-between'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-5 w-16 rounded-md' />
          </div>
          <Skeleton className='h-3 w-28' />
        </div>
      ))}
    </div>
  )
}

export function RegionRoutesMobileList(props: RegionRoutesMobileListProps) {
  const { t } = useTranslation()
  const rows = props.table.getRowModel().rows

  if (props.isLoading) return <RegionRoutesMobileSkeleton />

  if (!rows.length) {
    return (
      <div className='rounded-lg border p-8'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Globe className='size-6' />
            </EmptyMedia>
            <EmptyTitle>{t('No Region Routes Found')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'No region routes available. Create your first region route to get started.'
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {rows.map((row) => {
        const route = row.original
        const strategyConfig = REGION_ROUTE_STRATEGY_CONFIG[route.strategy]
        return (
          <div
            key={row.id}
            className='bg-card space-y-2.5 border-b px-3 py-2.5 last:border-b-0'
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='truncate text-sm font-semibold'>
                  {route.region}
                </div>
                <div className='text-muted-foreground text-[11px]'>
                  {route.model === '' ? '*' : route.model}
                </div>
              </div>
              <StatusBadge
                label={t(route.enabled ? 'Enabled' : 'Disabled')}
                variant={route.enabled ? 'success' : 'neutral'}
                copyable={false}
              />
            </div>

            <div className='flex items-center justify-between gap-2 text-xs'>
              <span className='text-muted-foreground'>{t('Strategy')}</span>
              <span className='font-medium'>
                {strategyConfig ? t(strategyConfig.labelKey) : route.strategy}
              </span>
              <DataTableRowActions row={row} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
