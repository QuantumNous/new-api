import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
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
import {
  useUpstreamRatioSyncColumns,
  type DifferenceRow,
} from './upstream-ratio-sync-columns'

type UpstreamRatioSyncTableProps = {
  differences: DifferencesMap
  resolutions: Record<string, Record<RatioType, number>>
  onSelectValue: (model: string, ratioType: RatioType, value: number) => void
  onUnselectValue: (model: string, ratioType: RatioType) => void
}

export function UpstreamRatioSyncTable({
  differences,
  resolutions,
  onSelectValue,
  onUnselectValue,
}: UpstreamRatioSyncTableProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [ratioTypeFilter, setRatioTypeFilter] = useState<string>('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const dataSource = useMemo(() => {
    const rows: DifferenceRow[] = []

    Object.entries(differences).forEach(([model, ratioTypes]) => {
      const hasPrice = 'model_price' in ratioTypes
      const hasOtherRatio = [
        'model_ratio',
        'completion_ratio',
        'cache_ratio',
      ].some((rt) => rt in ratioTypes)
      const billingConflict = hasPrice && hasOtherRatio

      Object.entries(ratioTypes).forEach(([ratioType, diff]) => {
        rows.push({
          key: `${model}_${ratioType}`,
          model,
          ratioType: ratioType as RatioType,
          current: diff.current,
          upstreams: diff.upstreams,
          confidence: diff.confidence || {},
          billingConflict,
        })
      })
    })

    return rows
  }, [differences])

  const filteredData = useMemo(() => {
    let filtered = dataSource

    if (search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter((row) =>
        row.model.toLowerCase().includes(searchLower)
      )
    }

    if (ratioTypeFilter && ratioTypeFilter !== '__all__') {
      filtered = filtered.filter((row) => row.ratioType === ratioTypeFilter)
    }

    return filtered
  }, [dataSource, search, ratioTypeFilter])

  const upstreamNames = useMemo(() => {
    const names = new Set<string>()
    filteredData.forEach((row) => {
      Object.keys(row.upstreams).forEach((name) => names.add(name))
    })
    return Array.from(names)
  }, [filteredData])

  const handleBulkSelect = (upstream: string, rows: DifferenceRow[]) => {
    rows.forEach((row) => {
      const value = row.upstreams[upstream]
      if (typeof value === 'number') {
        onSelectValue(row.model, row.ratioType, value)
      }
    })
  }

  const handleBulkUnselect = (_upstream: string, rows: DifferenceRow[]) => {
    rows.forEach((row) => {
      onUnselectValue(row.model, row.ratioType)
    })
  }

  const columns = useUpstreamRatioSyncColumns(
    upstreamNames,
    resolutions,
    onSelectValue,
    onUnselectValue,
    handleBulkSelect,
    handleBulkUnselect
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  if (dataSource.length === 0) {
    return (
      <div className='flex h-64 items-center justify-center rounded-md border'>
        <div className='text-center'>
          <p className='text-muted-foreground text-sm'>
            {t('No upstream ratio differences found')}
          </p>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('Select sync channels to compare ratios')}
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
            className='ps-8'
          />
        </div>
        <Select value={ratioTypeFilter} onValueChange={setRatioTypeFilter}>
          <SelectTrigger className='w-full sm:w-48'>
            <SelectValue placeholder={t('Filter by ratio type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>{t('All Types')}</SelectItem>
            {RATIO_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
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
                    <TableHead key={header.id}>
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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
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
