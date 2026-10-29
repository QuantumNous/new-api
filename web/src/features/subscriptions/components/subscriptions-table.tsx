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
import { useQuery } from '@tanstack/react-query'
import type { ColumnFiltersState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePage,
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  useDataTable,
} from '@/components/data-table'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getAdminPlans } from '../api'
import { useSubscriptionsColumns } from './subscriptions-columns'
import { useSubscriptions } from './subscriptions-provider'

export function SubscriptionsTable() {
  const { t } = useTranslation()
  const columns = useSubscriptionsColumns()
  const { refreshTrigger } = useSubscriptions()
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscription-plans', refreshTrigger],
    queryFn: async () => {
      const result = requireServerSuccess(await getAdminPlans())
      return result.data || []
    },
    placeholderData: (prev) => prev,
  })

  const plans = useMemo(() => data || [], [data])

  const { table } = useDataTable({
    data: plans,
    columns,
    columnFilters,
    onColumnFiltersChange: setColumnFilters,
    initialColumnVisibility: {
      id: false,
      sort_order: false,
      reset: false,
      payment: false,
      upgrade_group: false,
    },
    columnVisibilityStorageKey: 'subscriptions-table-columns-v3',
    enableColumnResizing: true,
    columnSizingStorageKey: 'subscriptions-column-sizing-v3',
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      emptyTitle={
        table.getState().columnFilters.length
          ? t('No results found.')
          : t('No subscription plans yet')
      }
      emptyDescription={
        table.getState().columnFilters.length
          ? t('Try adjusting your search')
          : t('Click "Create Plan" to create your first subscription plan')
      }
      skeletonKeyPrefix='subscriptions-skeleton'
      getColumnClassName={(columnId) =>
        columnId === 'actions' ? 'pl-4' : undefined
      }
      getRowClassName={(row, { isMobile }) => {
        if (row.original.plan.enabled) return undefined
        return isMobile ? DISABLED_ROW_MOBILE : DISABLED_ROW_DESKTOP
      }}
      toolbarProps={{
        searchKey: 'title',
        searchPlaceholder: t('Filter by name...'),
        filters: [
          {
            columnId: 'enabled',
            title: t('Status'),
            singleSelect: true,
            options: [
              { label: t('Enabled'), value: 'true' },
              { label: t('Disabled'), value: 'false' },
            ],
          },
        ],
      }}
      applyHeaderSize
    />
  )
}
