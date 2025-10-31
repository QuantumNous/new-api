import type { Table } from '@tanstack/react-table'
import { TableRow, TableCell } from '@/components/ui/table'
import { SkeletonWrapper } from '@/components/skeleton-wrapper'

interface TableSkeletonProps<TData> {
  /**
   * Table instance from @tanstack/react-table
   */
  table: Table<TData>
  /**
   * Number of skeleton rows to display
   * If not provided, will be calculated from table's pageSize (max 20)
   */
  rowCount?: number
  /**
   * Row height class
   * @default 'h-14'
   */
  rowHeight?: string
  /**
   * Skeleton height
   * @default 16
   */
  skeletonHeight?: number
  /**
   * Custom skeleton className
   */
  skeletonClassName?: string
  /**
   * Custom key prefix for skeleton rows
   * @default 'skeleton'
   */
  keyPrefix?: string
}

/**
 * Generic table skeleton component for loading states
 * Automatically renders skeleton rows based on visible columns
 */
export function TableSkeleton<TData>({
  table,
  rowCount,
  rowHeight = 'h-14',
  skeletonHeight = 16,
  skeletonClassName = 'h-4 w-full',
  keyPrefix = 'skeleton',
}: TableSkeletonProps<TData>) {
  const visibleColumns = table.getVisibleLeafColumns()

  // Auto-calculate rowCount from table's pageSize if not provided
  const finalRowCount =
    rowCount ?? Math.min(table.getState().pagination?.pageSize || 20, 20)

  return (
    <>
      {Array.from({ length: finalRowCount }, (_, index) => (
        <TableRow key={`${keyPrefix}-${index}`} className={rowHeight}>
          {visibleColumns.map((column) => {
            // Special rendering for checkbox column
            const isSelectColumn = column.id === 'select'

            return (
              <TableCell key={column.id}>
                <SkeletonWrapper
                  loading
                  type='text'
                  width={isSelectColumn ? 16 : '100%'}
                  height={isSelectColumn ? 16 : skeletonHeight}
                  className={
                    isSelectColumn ? 'h-4 w-4 rounded' : skeletonClassName
                  }
                />
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}
