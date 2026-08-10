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
import { Store } from 'lucide-react'
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

import { DISTRIBUTOR_STATUS_CONFIG, DISTRIBUTOR_TIER_CONFIG } from '../constants'
import type { Distributor } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

interface DistributorsMobileListProps {
  table: TanstackTable<Distributor>
  isLoading: boolean
}

const MOBILE_SKELETON_KEYS = [
  'distributor-mobile-skeleton-1',
  'distributor-mobile-skeleton-2',
  'distributor-mobile-skeleton-3',
]

function DistributorsMobileSkeleton() {
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

export function DistributorsMobileList(props: DistributorsMobileListProps) {
  const { t } = useTranslation()
  const rows = props.table.getRowModel().rows

  if (props.isLoading) return <DistributorsMobileSkeleton />

  if (!rows.length) {
    return (
      <div className='rounded-lg border p-8'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Store className='size-6' />
            </EmptyMedia>
            <EmptyTitle>{t('No Distributors Found')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'No distributors available. Create your first distributor to get started.'
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
        const distributor = row.original
        const tierConfig = DISTRIBUTOR_TIER_CONFIG[distributor.tier]
        const statusConfig = DISTRIBUTOR_STATUS_CONFIG[distributor.status]
        return (
          <div
            key={row.id}
            className='bg-card space-y-2.5 border-b px-3 py-2.5 last:border-b-0'
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='truncate text-sm font-semibold'>
                  {distributor.name}
                </div>
                <div className='text-muted-foreground text-[11px]'>
                  {t('Owner User ID')}: {distributor.user_id}
                </div>
              </div>
              {statusConfig && (
                <StatusBadge
                  label={t(statusConfig.labelKey)}
                  variant={statusConfig.variant}
                  copyable={false}
                />
              )}
            </div>

            <div className='flex items-center justify-between gap-2 text-xs'>
              <span className='text-muted-foreground'>
                {tierConfig ? t(tierConfig.labelKey) : distributor.tier}
              </span>
              <span className='font-medium tabular-nums'>
                {distributor.commission_rate}%
              </span>
              <DataTableRowActions row={row} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
