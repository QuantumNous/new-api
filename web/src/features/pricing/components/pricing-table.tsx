import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableSkeleton, TableEmpty } from '@/components/data-table'
import { DataTablePagination } from '@/components/data-table/pagination'
import { DEFAULT_PRICING_PAGE_SIZE, DEFAULT_TOKEN_UNIT } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import { getPricingColumns } from './pricing-columns'

// ----------------------------------------------------------------------------
// Pricing Table Component
// ----------------------------------------------------------------------------

export interface PricingTableProps {
  models: PricingModel[]
  isLoading?: boolean
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
}

export function PricingTable({
  models,
  isLoading = false,
  priceRate = 1,
  usdExchangeRate = 1,
  tokenUnit = DEFAULT_TOKEN_UNIT,
}: PricingTableProps) {
  const navigate = useNavigate({ from: '/pricing' })
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PRICING_PAGE_SIZE,
  })

  // Generate columns with current options
  const columns = useMemo(
    () =>
      getPricingColumns({
        tokenUnit,
        priceRate,
        usdExchangeRate,
      }),
    [tokenUnit, priceRate, usdExchangeRate]
  )

  // React Table instance
  const table = useReactTable({
    data: models,
    columns,
    pageCount: Math.ceil(models.length / pagination.pageSize),
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
  })

  // Handle row click to navigate to model detail
  const handleRowClick = useCallback(
    (model: PricingModel) => {
      navigate({
        to: '/pricing/$modelId',
        params: { modelId: model.model_name },
        search: (prev) => prev,
      })
    },
    [navigate]
  )

  return (
    <div className='space-y-4'>
      {/* Table */}
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                  >
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
            {isLoading ? (
              <TableSkeleton table={table} keyPrefix='pricing-skeleton' />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableEmpty
                colSpan={columns.length}
                title='No Models Found'
                description='No models match your current filters.'
              />
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => handleRowClick(row.original)}
                  className='cursor-pointer'
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
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && models.length > 0 && (
        <DataTablePagination table={table as any} />
      )}
    </div>
  )
}

// Helper to render cell content
function flexRender(content: any, context: any) {
  if (typeof content === 'function') {
    return content(context)
  }
  return content
}
