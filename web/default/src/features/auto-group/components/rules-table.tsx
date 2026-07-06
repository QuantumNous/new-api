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

import { DataTablePage, useDataTable } from '@/components/data-table'

import { getAutoGroupRules } from '../api'
import { QUERY_KEYS } from '../constants'
import { useRulesColumns } from './rules-columns'

export function RulesTable() {
  const { t } = useTranslation()
  const columns = useRulesColumns()

  // The API returns all rules at once — no server-side pagination needed.
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: QUERY_KEYS.RULES,
    queryFn: getAutoGroupRules,
  })

  const rules = useMemo(
    () => data?.data ?? [],
    [data]
  )

  const { table } = useDataTable({
    data: rules,
    columns,
    columnFilters,
    onColumnFiltersChange: setColumnFilters,
    globalFilter,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const jobTitle = String(row.getValue('job_title')).toLowerCase()
      const targetGroup = String(
        row.getValue('target_group')
      ).toLowerCase()
      const remark = String(row.original.remark ?? '').toLowerCase()
      const searchValue = String(filterValue).toLowerCase()
      return (
        jobTitle.includes(searchValue) ||
        targetGroup.includes(searchValue) ||
        remark.includes(searchValue)
      )
    },
    initialPagination: { pageIndex: 0, pageSize: 20 },
  })

  const enabledFilterOptions = useMemo(
    () => [
      { label: t('Enabled'), value: 'true' },
      { label: t('Disabled'), value: 'false' },
    ],
    [t]
  )

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Rules Found')}
      emptyDescription={t(
        'No auto group rules yet. Create a rule or initialize from existing users.'
      )}
      skeletonKeyPrefix='auto-group-rules-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by job title, group or remark...'),
        hideViewOptions: true,
        filters: [
          {
            columnId: 'enabled',
            title: t('Status'),
            options: enabledFilterOptions,
            singleSelect: true,
          },
        ],
      }}
    />
  )
}
