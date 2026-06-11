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
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import {
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { getCombos } from '../api'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { useCombosColumns } from './combos-columns'
import { CombosBulkActions } from './combos-bulk-actions'
import { useCombos } from './combos-provider'

const route = getRouteApi('/_authenticated/combos/')

export function CombosTable() {
  const { refreshTrigger } = useCombos()

  const { t } = useTranslation()
  const columns = useCombosColumns()

  const {
    globalFilter,
    onGlobalFilterChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: 20 },
    globalFilter: { enabled: true, key: 'keyword' },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['combos', pagination.pageIndex + 1, pagination.pageSize, globalFilter, refreshTrigger],
    queryFn: async () => {
      const result = await getCombos({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        keyword: globalFilter || undefined,
      })
      return {
        items: result.items,
        total: result.total,
      }
    },
  })

  const combos = data?.items ?? []

  const { table } = useDataTable({
    data: combos,
    columns,
    enableRowSelection: true,
    pagination,
    globalFilter,
    onPaginationChange,
    onGlobalFilterChange,
    manualPagination: true,
    totalCount: data?.total ?? 0,
    ensurePageInRange,
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      emptyTitle={t('No Combos Found')}
      emptyDescription={t('No combos available. Create your first combo to get started.')}
      bulkActions={<CombosBulkActions table={table} />}
      renderToolbar={() => (
        <div className='flex items-center gap-2'>
          <Input
            placeholder={t('Search combos...')}
            value={globalFilter ?? ''}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            className='max-w-sm'
          />
        </div>
      )}
    />
  )
}
