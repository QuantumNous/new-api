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
import type { Table as TanstackTable } from '@tanstack/react-table'
import { Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DISABLED_ROW_MOBILE } from '@/components/data-table'
import { MaskedValueDisplay } from '@/components/masked-value-display'
import { StatusBadge } from '@/components/status-badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import {
  REGISTRATION_CODE_STATUS,
  REGISTRATION_CODE_STATUSES,
} from '../constants'
import { isRegistrationCodeExpired } from '../lib'
import type { RegistrationCode } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { RegistrationCodeUsedCell } from './registration-code-used-cell'

const MOBILE_SKELETON_KEYS = [
  'registration-code-mobile-skeleton-1',
  'registration-code-mobile-skeleton-2',
  'registration-code-mobile-skeleton-3',
  'registration-code-mobile-skeleton-4',
  'registration-code-mobile-skeleton-5',
]

function RegistrationCodesMobileSkeleton() {
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
          <div className='flex items-center justify-between gap-3'>
            <Skeleton className='h-7 w-44' />
            <Skeleton className='h-8 w-16' />
          </div>
          <Skeleton className='h-3 w-28' />
        </div>
      ))}
    </div>
  )
}

interface RegistrationCodesMobileListProps {
  table: TanstackTable<RegistrationCode>
  isLoading: boolean
}

export function RegistrationCodesMobileList(
  props: RegistrationCodesMobileListProps
) {
  const { t } = useTranslation()
  const rows = props.table.getRowModel().rows

  if (props.isLoading) return <RegistrationCodesMobileSkeleton />

  if (!rows.length) {
    return (
      <div className='rounded-lg border p-8'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Database className='size-6' />
            </EmptyMedia>
            <EmptyTitle>{t('No Registration Codes Found')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'No registration codes available. Create your first registration code to get started.'
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
        const registrationCode = row.original
        const expired = isRegistrationCodeExpired(
          registrationCode.expired_time,
          registrationCode.status
        )
        const statusConfig = REGISTRATION_CODE_STATUSES[registrationCode.status]
        const maskedKey = `${registrationCode.key.slice(0, 8)}******${registrationCode.key.slice(-8)}`

        return (
          <div
            key={row.id}
            className={cn(
              'bg-card space-y-2.5 border-b px-3 py-2.5 last:border-b-0',
              expired ||
                registrationCode.status !== REGISTRATION_CODE_STATUS.UNUSED
                ? DISABLED_ROW_MOBILE
                : undefined
            )}
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='truncate text-sm font-semibold'>
                  {registrationCode.name}
                </div>
                <div className='text-muted-foreground text-[11px]'>
                  {t('Registration Code')}
                </div>
              </div>
              {expired ? (
                <StatusBadge
                  label={t('Expired')}
                  variant='warning'
                  copyable={false}
                />
              ) : (
                statusConfig && (
                  <StatusBadge
                    label={t(statusConfig.labelKey)}
                    variant={statusConfig.variant}
                    copyable={false}
                  />
                )
              )}
            </div>

            <div className='flex min-w-0 items-center justify-between gap-2'>
              <div className='min-w-0 flex-1 [&_button:first-child]:max-w-full [&_button:first-child]:truncate [&_button:first-child]:px-0'>
                <MaskedValueDisplay
                  label={t('Full Code')}
                  fullValue={registrationCode.key}
                  maskedValue={maskedKey}
                  copyTooltip={t('Copy code')}
                  copyAriaLabel={t('Copy registration code')}
                />
              </div>
              <DataTableRowActions row={row} />
            </div>

            <div className='flex items-center justify-between gap-2 text-xs'>
              <span className='text-muted-foreground'>{t('Used')}</span>
              <RegistrationCodeUsedCell registrationCode={registrationCode} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
