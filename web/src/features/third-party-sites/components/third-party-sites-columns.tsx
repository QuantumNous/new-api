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

import { TruncatedText } from '@/components/truncated-text'

import { THIRD_PARTY_SITE_TYPE_OPTIONS } from '../constants'
import type { ThirdPartySite } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { ReceivableDiscountCell } from './receivable-discount-cell'

export function useThirdPartySitesColumns(): ColumnDef<ThirdPartySite>[] {
  const { t } = useTranslation()
  return [
    {
      accessorKey: 'name',
      header: t('Name'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'type',
      header: t('Type'),
      cell: ({ row }) => {
        const option = THIRD_PARTY_SITE_TYPE_OPTIONS.find(
          (item) => item.value === row.original.type
        )
        return option ? t(option.labelKey) : row.original.type
      },
    },
    {
      accessorKey: 'base_url',
      header: t('Site Base URL'),
      cell: ({ row }) => (
        <TruncatedText text={row.original.base_url} maxWidth='max-w-[280px]' />
      ),
    },
    {
      accessorKey: 'receivable_discount',
      header: t('Receivable Discount'),
      cell: ({ row }) => (
        <ReceivableDiscountCell value={row.original.receivable_discount} />
      ),
    },
    {
      accessorKey: 'remote_user_id',
      header: t('Remote User ID'),
    },
    {
      id: 'actions',
      header: t('Actions'),
      cell: ({ row }) => <DataTableRowActions row={row} />,
    },
  ]
}
