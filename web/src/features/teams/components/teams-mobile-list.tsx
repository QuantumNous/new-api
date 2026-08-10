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
import { Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

import type { Team } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

interface TeamsMobileListProps {
  table: TanstackTable<Team>
  isLoading: boolean
}

const MOBILE_SKELETON_KEYS = [
  'team-mobile-skeleton-1',
  'team-mobile-skeleton-2',
  'team-mobile-skeleton-3',
]

function TeamsMobileSkeleton() {
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

export function TeamsMobileList(props: TeamsMobileListProps) {
  const { t } = useTranslation()
  const rows = props.table.getRowModel().rows

  if (props.isLoading) return <TeamsMobileSkeleton />

  if (!rows.length) {
    return (
      <div className='rounded-lg border p-8'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Building2 className='size-6' />
            </EmptyMedia>
            <EmptyTitle>{t('No Teams Found')}</EmptyTitle>
            <EmptyDescription>
              {t('No teams available. Create your first team to get started.')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {rows.map((row) => {
        const team = row.original
        return (
          <div
            key={row.id}
            className='bg-card space-y-2.5 border-b px-3 py-2.5 last:border-b-0'
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='truncate text-sm font-semibold'>
                  {team.name}
                </div>
                <div className='text-muted-foreground truncate text-[11px]'>
                  {team.description || '-'}
                </div>
              </div>
            </div>

            <div className='flex items-center justify-between gap-2 text-xs'>
              <span className='text-muted-foreground'>
                {t('Owner User ID')}: {team.owner_id}
              </span>
              <DataTableRowActions row={row} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
