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

import { MaskedValueDisplay } from '@/components/masked-value-display'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import { formatTimestampToDate } from '@/lib/format'

import {
  REGISTRATION_CODE_FILTER_EXPIRED,
  REGISTRATION_CODE_STATUSES,
} from '../constants'
import { isRegistrationCodeExpired, isTimestampExpired } from '../lib'
import type { RegistrationCode } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { RegistrationCodeUsedCell } from './registration-code-used-cell'

export function useRegistrationCodesColumns(): ColumnDef<RegistrationCode>[] {
  const { t } = useTranslation()
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('Select all')}
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('Select row')}
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'id',
      header: t('ID'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        return (
          <TableId value={row.getValue('id') as number} className='w-[60px]' />
        )
      },
      size: 80,
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-medium'>{row.getValue('name')}</span>
      ),
      size: 180,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const registrationCode = row.original
        const statusValue = row.getValue('status') as number

        // Check if expired
        if (
          isRegistrationCodeExpired(registrationCode.expired_time, statusValue)
        ) {
          return (
            <StatusBadge
              label={t('Expired')}
              variant='warning'
              copyable={false}
              className='-ml-1.5'
            />
          )
        }

        const statusConfig = REGISTRATION_CODE_STATUSES[statusValue]

        if (!statusConfig) {
          return null
        }

        return (
          <StatusBadge
            label={t(statusConfig.labelKey)}
            variant={statusConfig.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      filterFn: (row, id, value) => {
        const registrationCode = row.original
        const statusValue = row.getValue(id) as number

        // Check if expired status is being filtered
        if (value.includes(REGISTRATION_CODE_FILTER_EXPIRED)) {
          if (
            isRegistrationCodeExpired(
              registrationCode.expired_time,
              statusValue
            )
          ) {
            return true
          }
        }

        // Check regular status
        return value.includes(String(statusValue))
      },
      size: 120,
    },
    {
      id: 'code',
      accessorKey: 'key',
      header: t('Code'),
      cell: function CodeCell({ row }) {
        const registrationCode = row.original
        const key = registrationCode.key
        const maskedKey = `${key.slice(0, 8)}${'*'.repeat(16)}${key.slice(-8)}`

        return (
          <MaskedValueDisplay
            label={t('Full Code')}
            fullValue={key}
            maskedValue={maskedKey}
            copyTooltip={t('Copy code')}
            copyAriaLabel={t('Copy registration code')}
          />
        )
      },
      enableSorting: false,
      size: 320,
    },
    {
      accessorKey: 'created_time',
      header: t('Created'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        return (
          <div className='min-w-[160px] font-mono text-sm'>
            {formatTimestampToDate(row.getValue('created_time'))}
          </div>
        )
      },
      size: 180,
    },
    {
      accessorKey: 'expired_time',
      header: t('Expires'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const expiredTime = row.getValue('expired_time') as number
        if (expiredTime === 0) {
          return (
            <StatusBadge
              label={t('Never')}
              variant='neutral'
              copyable={false}
              className='-ml-1.5'
            />
          )
        }
        const isExpired = isTimestampExpired(expiredTime)
        return (
          <div
            className={`min-w-[160px] font-mono text-sm ${isExpired ? 'text-destructive' : ''}`}
          >
            {formatTimestampToDate(expiredTime)}
          </div>
        )
      },
      size: 180,
    },
    {
      id: 'used',
      accessorKey: 'used_username',
      header: t('Used'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <RegistrationCodeUsedCell registrationCode={row.original} />
      ),
      enableSorting: false,
      size: 140,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <DataTableRowActions row={row} />,
      meta: { pinned: 'right' as const },
    },
  ]
}
