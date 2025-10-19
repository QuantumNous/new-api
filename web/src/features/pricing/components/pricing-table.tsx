import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import type { PricingModel } from '../type'
import { getPricingColumns } from './pricing-columns'

type PricingTableProps = {
  models: PricingModel[]
  currency: 'USD' | 'CNY'
  tokenUnit: 'M' | 'K'
  showWithRecharge: boolean
  priceRate: number
  usdExchangeRate: number
}

export function PricingTable({
  models,
  currency,
  tokenUnit,
  showWithRecharge,
  priceRate,
  usdExchangeRate,
}: PricingTableProps) {
  const navigate = useNavigate({ from: '/pricing' })
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo(
    () =>
      getPricingColumns({
        currency,
        tokenUnit,
        showWithRecharge,
        priceRate,
        usdExchangeRate,
      }),
    [currency, tokenUnit, showWithRecharge, priceRate, usdExchangeRate]
  )

  const table = useReactTable({
    data: models,
    columns,
    state: {
      columnVisibility,
      globalFilter,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      return (
        row.original.model_name?.toLowerCase().includes(searchValue) ||
        row.original.description?.toLowerCase().includes(searchValue) ||
        row.original.tags?.toLowerCase().includes(searchValue) ||
        row.original.vendor_name?.toLowerCase().includes(searchValue) ||
        false
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  })

  return (
    <Card className='p-6'>
      <div className='mb-4 flex items-center justify-between'>
        <DataTableToolbar table={table} searchPlaceholder='Search models...' />
        <div className='text-muted-foreground ml-4 text-sm'>
          {table.getFilteredRowModel().rows.length} models
        </div>
      </div>

      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className='cursor-pointer'
                  tabIndex={0}
                  role='button'
                  onClick={() => {
                    navigate({
                      to: '/pricing/$modelId',
                      params: { modelId: row.original.model_name || '' },
                      search: (prev) => prev,
                    })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate({
                        to: '/pricing/$modelId',
                        params: { modelId: row.original.model_name || '' },
                        search: (prev) => prev,
                      })
                    }
                  }}
                >
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
                  className='text-muted-foreground h-24 text-center'
                >
                  No models found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='mt-4'>
        <DataTablePagination table={table} />
      </div>
    </Card>
  )
}
