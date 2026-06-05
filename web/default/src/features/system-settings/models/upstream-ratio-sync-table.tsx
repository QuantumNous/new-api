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
import { useCallback, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Loader2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/data-table/pagination'
import type { DifferencesMap, RatioType } from '../types'
import { RATIO_TYPE_OPTIONS } from './constants'
import { useUpstreamRatioSyncColumns } from './upstream-ratio-sync-columns'
import {
  getOrderedRatioTypes,
  getPreferredSyncField,
  isSelectableUpstreamValue,
  RATIO_SYNC_FIELDS,
  type ModelRow,
  type ResolutionsMap,
} from './upstream-ratio-sync-helpers'

type UpstreamRatioSyncTableProps = {
  differences: DifferencesMap
  resolutions: ResolutionsMap
  isDisabled: boolean
  isSyncing: boolean
  onSelectValue: (
    model: string,
    ratioType: RatioType,
    value: number | string,
    sourceName: string
  ) => void
  onUnselectValue: (model: string, ratioType: RatioType) => void
}

export function UpstreamRatioSyncTable({
  differences,
  resolutions,
  isDisabled,
  isSyncing,
  onSelectValue,
  onUnselectValue,
}: UpstreamRatioSyncTableProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [ratioTypeFilter, setRatioTypeFilter] = useState<string>('')

  const dataSource = useMemo<ModelRow[]>(() => {
    return Object.entries(differences).map(([model, ratioTypes]) => {
      const hasPrice = 'model_price' in ratioTypes
      const hasOtherRatio = RATIO_SYNC_FIELDS.some((rt) => rt in ratioTypes)
      return {
        key: model,
        model,
        ratioTypes,
        billingConflict: hasPrice && hasOtherRatio,
      }
    })
  }, [differences])

  const filteredData = useMemo(() => {
    let data = dataSource

    if (search.trim()) {
      const lower = search.toLowerCase()
      data = data.filter((row) => row.model.toLowerCase().includes(lower))
    }

    if (ratioTypeFilter && ratioTypeFilter !== '__all__') {
      data = data.filter((row) => ratioTypeFilter in row.ratioTypes)
    }

    return data
  }, [dataSource, search, ratioTypeFilter])

  const upstreamNames = useMemo(() => {
    const set = new Set<string>()
    filteredData.forEach((row) => {
      getOrderedRatioTypes(row.ratioTypes, ratioTypeFilter).forEach(
        (ratioType) => {
          Object.keys(row.ratioTypes[ratioType]?.upstreams || {}).forEach(
            (name) => set.add(name)
          )
        }
      )
    })
    return Array.from(set)
  }, [filteredData, ratioTypeFilter])

  const handleBulkSelect = useCallback(
    (upstream: string, rows: ModelRow[]) => {
      rows.forEach((row) => {
        getOrderedRatioTypes(row.ratioTypes, ratioTypeFilter).forEach(
          (ratioType) => {
            const upstreamVal = row.ratioTypes[ratioType]?.upstreams?.[upstream]
            const preferredField = getPreferredSyncField(
              row.ratioTypes,
              ratioType,
              upstream
            )
            if (
              preferredField === ratioType &&
              isSelectableUpstreamValue(upstreamVal)
            ) {
              onSelectValue(
                row.model,
                ratioType,
                upstreamVal as number | string,
                upstream
              )
            }
          }
        )
      })
    },
    [ratioTypeFilter, onSelectValue]
  )

  const handleBulkUnselect = useCallback(
    (upstream: string, rows: ModelRow[]) => {
      rows.forEach((row) => {
        getOrderedRatioTypes(row.ratioTypes, ratioTypeFilter).forEach(
          (ratioType) => {
            if (
              row.ratioTypes[ratioType]?.upstreams?.[upstream] !== undefined
            ) {
              onUnselectValue(row.model, ratioType)
            }
          }
        )
      })
    },
    [ratioTypeFilter, onUnselectValue]
  )

  const columns = useUpstreamRatioSyncColumns(
    upstreamNames,
    resolutions,
    ratioTypeFilter,
    isDisabled,
    onSelectValue,
    onUnselectValue,
    handleBulkSelect,
    handleBulkUnselect
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.key,
    initialState: {
      pagination: { pageSize: 10 },
    },
  })

  if (dataSource.length === 0) {
    if (isSyncing) {
      return (
        <div className='flex h-64 flex-col items-center justify-center gap-3 rounded-md border'>
          <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
          <p className='text-muted-foreground text-sm'>
            {t('Fetching upstream prices...')}
          </p>
        </div>
      )
    }

    return (
      <div className='flex h-64 items-center justify-center rounded-md border'>
        <div className='text-center'>
          <p className='text-muted-foreground text-sm'>
            {t('No upstream price differences found')}
          </p>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('Select sync channels to compare prices')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder={t('Search model name...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={isDisabled}
            className='ps-8'
          />
        </div>
        <Select
          items={[
            { value: '__all__', label: t('All Types') },
            ...RATIO_TYPE_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.label),
            })),
          ]}
          value={ratioTypeFilter}
          onValueChange={(v) => v !== null && setRatioTypeFilter(v)}
          disabled={isDisabled}
        >
          <SelectTrigger className='w-full sm:w-56'>
            <SelectValue placeholder={t('Filter by price field')} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              <SelectItem value='__all__'>{t('All Types')}</SelectItem>
              {RATIO_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.label)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className='overflow-hidden rounded-md border'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className='align-top'>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className='align-top'>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className='align-top'>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className='h-24 text-center'
                  >
                    {t('No results found')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DataTablePagination table={table} />
    </div>
  )
}
