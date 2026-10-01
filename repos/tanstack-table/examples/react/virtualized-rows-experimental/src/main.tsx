import React from 'react'
import ReactDOM from 'react-dom/client'

import './index.css'

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { makeData } from './makeData'
import type { ColumnDef, Row, Table } from '@tanstack/react-table'
import type { Virtualizer } from '@tanstack/react-virtual'
import type { Person } from './makeData'

// This is a dynamic row height example, which is more complicated, but allows for a more realistic table.
// See https://tanstack.com/virtual/v3/docs/examples/react/table for a simpler fixed row height example.
function App() {
  const columns = React.useMemo<Array<ColumnDef<Person>>>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 60,
      },
      {
        accessorKey: 'firstName',
        cell: info => info.getValue(),
      },
      {
        accessorFn: row => row.lastName,
        id: 'lastName',
        cell: info => info.getValue(),
        header: () => <span>Last Name</span>,
      },
      {
        accessorKey: 'age',
        header: () => 'Age',
        size: 50,
      },
      {
        accessorKey: 'visits',
        header: () => <span>Visits</span>,
        size: 50,
      },
      {
        accessorKey: 'status',
        header: 'Status',
      },
      {
        accessorKey: 'progress',
        header: 'Profile Progress',
        size: 80,
      },
      {
        accessorKey: 'createdAt',
        header: 'Created At',
        cell: info => info.getValue<Date>().toLocaleString(),
        size: 250,
      },
    ],
    []
  )

  const [data, _setData] = React.useState(() => makeData(50_000))

  const refreshData = React.useCallback(() => {
    _setData(makeData(50_000))
  }, [])

  // refresh data every 5 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshData()
    }, 5000)
    return () => clearInterval(interval)
  }, [refreshData])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
  })

  // The virtualizer needs to know the scrollable container element
  const tableContainerRef = React.useRef<HTMLDivElement>(null)

  // All important CSS styles are included as inline styles for this example. This is not recommended for your code.
  return (
    <div className="app">
      {process.env.NODE_ENV === 'development' ? (
        <p>
          <strong>Notice:</strong> You are currently running React in
          development mode. Virtualized rendering performance will be slightly
          degraded until this application is built for production.
        </p>
      ) : null}
      ({data.length} rows)
      <button onClick={refreshData}>Refresh Data</button>
      <div
        className="container"
        ref={tableContainerRef}
        style={{
          overflow: 'auto', // our scrollable table container
          position: 'relative', // needed for sticky header
          height: '800px', // should be a fixed height
        }}
      >
        {/* Even though we're still using sematic table tags, we must use CSS grid and flexbox for dynamic row heights */}
        <table style={{ display: 'grid' }}>
          <thead
            style={{
              display: 'grid',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            {table.getHeaderGroups().map(headerGroup => (
              <tr
                key={headerGroup.id}
                style={{ display: 'flex', width: '100%' }}
              >
                {headerGroup.headers.map(header => {
                  return (
                    <th
                      key={header.id}
                      style={{
                        display: 'flex',
                        width: header.getSize(),
                      }}
                    >
                      <div
                        {...{
                          className: header.column.getCanSort()
                            ? 'cursor-pointer select-none'
                            : '',
                          onClick: header.column.getToggleSortingHandler(),
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: ' 🔼',
                          desc: ' 🔽',
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <TableBodyWrapper
            table={table}
            tableContainerRef={tableContainerRef}
          />
        </table>
      </div>
    </div>
  )
}

interface TableBodyWrapperProps {
  table: Table<Person>
  tableContainerRef: React.RefObject<HTMLDivElement>
}

function TableBodyWrapper({ table, tableContainerRef }: TableBodyWrapperProps) {
  const rowRefsMap = React.useRef<Map<number, HTMLTableRowElement>>(new Map())

  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    estimateSize: () => 33, // estimate row height for accurate scrollbar dragging
    getScrollElement: () => tableContainerRef.current,
    // measure dynamic row height, except in firefox because it measures table border height incorrectly
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? element => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
    onChange: instance => {
      // requestAnimationFrame(() => {
      instance.getVirtualItems().forEach(virtualRow => {
        const rowRef = rowRefsMap.current.get(virtualRow.index)
        if (!rowRef) return
        rowRef.style.transform = `translateY(${virtualRow.start}px)`
      })
      // })
    },
  })

  React.useLayoutEffect(() => {
    rowVirtualizer.measure()
  }, [table.getState()])

  return (
    <TableBody
      rowRefsMap={rowRefsMap}
      rowVirtualizer={rowVirtualizer}
      table={table}
    />
  )
}

interface TableBodyProps {
  table: Table<Person>
  rowVirtualizer: Virtualizer<HTMLDivElement, HTMLTableRowElement>
  rowRefsMap: React.MutableRefObject<Map<number, HTMLTableRowElement>>
}

function TableBody({ rowVirtualizer, table, rowRefsMap }: TableBodyProps) {
  const { rows } = table.getRowModel()
  const virtualRowIndexes = rowVirtualizer.getVirtualIndexes()

  return (
    <tbody
      style={{
        display: 'grid',
        height: `${rowVirtualizer.getTotalSize()}px`, // tells scrollbar how big the table is
        position: 'relative', // needed for absolute positioning of rows
      }}
    >
      {virtualRowIndexes.map(virtualRowIndex => {
        const row = rows[virtualRowIndex]
        return (
          <TableBodyRowMemo
            key={row.id}
            row={row}
            rowRefsMap={rowRefsMap}
            rowVirtualizer={rowVirtualizer}
            virtualRowIndex={virtualRowIndex}
          />
        )
      })}
    </tbody>
  )
}

interface TableBodyRowProps {
  row: Row<Person>
  rowRefsMap: React.MutableRefObject<Map<number, HTMLTableRowElement>>
  rowVirtualizer: Virtualizer<HTMLDivElement, HTMLTableRowElement>
  virtualRowIndex: number
}

function TableBodyRow({
  row,
  rowRefsMap,
  rowVirtualizer,
  virtualRowIndex,
}: TableBodyRowProps) {
  return (
    <tr
      data-index={virtualRowIndex} // needed for dynamic row height measurement
      ref={node => {
        if (node && virtualRowIndex) {
          rowVirtualizer.measureElement(node) // measure dynamic row height
          rowRefsMap.current.set(virtualRowIndex, node) // store ref for virtualizer to apply scrolling transforms
        }
      }}
      key={row.id}
      style={{
        display: 'flex',
        position: 'absolute',
        width: '100%',
      }}
    >
      {row.getVisibleCells().map(cell => {
        return (
          <td
            key={cell.id}
            style={{
              display: 'flex',
              width: cell.column.getSize(),
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        )
      })}
    </tr>
  )
}

// test out when rows don't re-render at all (future TanStack Virtual release can make this unnecessary)
const TableBodyRowMemo = React.memo(
  TableBodyRow,
  (_prev, next) => next.rowVirtualizer.isScrolling
) as typeof TableBodyRow

const rootElement = document.getElementById('root')

if (!rootElement) throw new Error('Failed to find the root element')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
