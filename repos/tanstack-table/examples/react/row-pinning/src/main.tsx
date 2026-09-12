import React from 'react'
import ReactDOM from 'react-dom/client'

import './index.css'

import { makeData, Person } from './makeData'

import {
  Column,
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  Row,
  RowPinningState,
  Table,
  useReactTable,
} from '@tanstack/react-table'

function App() {
  const rerender = React.useReducer(() => ({}), {})[1]

  //table states
  const [rowPinning, setRowPinning] = React.useState<RowPinningState>({
    top: [],
    bottom: [],
  })
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  //demo states
  const [keepPinnedRows, setKeepPinnedRows] = React.useState(true)
  const [includeLeafRows, setIncludeLeafRows] = React.useState(true)
  const [includeParentRows, setIncludeParentRows] = React.useState(false)
  const [copyPinnedRows, setCopyPinnedRows] = React.useState(false)

  const columns = React.useMemo<ColumnDef<Person>[]>(
    () => [
      {
        id: 'pin',
        header: () => 'Pin',
        cell: ({ row }) =>
          row.getIsPinned() ? (
            <button
              onClick={() => row.pin(false, includeLeafRows, includeParentRows)}
            >
              ❌
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() =>
                  row.pin('top', includeLeafRows, includeParentRows)
                }
              >
                ⬆️
              </button>
              <button
                onClick={() =>
                  row.pin('bottom', includeLeafRows, includeParentRows)
                }
              >
                ⬇️
              </button>
            </div>
          ),
      },
      {
        accessorKey: 'firstName',
        header: ({ table }) => (
          <>
            <button
              {...{
                onClick: table.getToggleAllRowsExpandedHandler(),
              }}
            >
              {table.getIsAllRowsExpanded() ? '👇' : '👉'}
            </button>{' '}
            First Name
          </>
        ),
        cell: ({ row, getValue }) => (
          <div
            style={{
              // Since rows are flattened by default,
              // we can use the row.depth property
              // and paddingLeft to visually indicate the depth
              // of the row
              paddingLeft: `${row.depth * 2}rem`,
            }}
          >
            <>
              {row.getCanExpand() ? (
                <button
                  {...{
                    onClick: row.getToggleExpandedHandler(),
                    style: { cursor: 'pointer' },
                  }}
                >
                  {row.getIsExpanded() ? '👇' : '👉'}
                </button>
              ) : (
                '🔵'
              )}{' '}
              {getValue()}
            </>
          </div>
        ),
        footer: props => props.column.id,
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
    ],
    [includeLeafRows, includeParentRows]
  )

  const [data, setData] = React.useState(() => makeData(1000, 2, 2))
  const refreshData = () => setData(() => makeData(1000, 2, 2))

  const table = useReactTable({
    data,
    columns,
    initialState: { pagination: { pageSize: 20, pageIndex: 0 } },
    state: {
      expanded,
      rowPinning,
    },
    onExpandedChange: setExpanded,
    onRowPinningChange: setRowPinning,
    getSubRows: row => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    keepPinnedRows,
    debugRows: true,
  })

  return (
    <div className="app">
      <div className="p-2 container">
        <div className="h-2" />
        <table>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <th key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : (
                        <>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanFilter() ? (
                            <div>
                              <Filter column={header.column} table={table} />
                            </div>
                          ) : null}
                        </>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getTopRows().map(row => (
              <PinnedRow key={row.id} row={row} table={table} />
            ))}
            {(copyPinnedRows
              ? table.getRowModel().rows
              : table.getCenterRows()
            ).map(row => {
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => {
                    return (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {table.getBottomRows().map(row => (
              <PinnedRow key={row.id} row={row} table={table} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="h-2" />
      <div className="flex items-center gap-2">
        <button
          className="border rounded p-1"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          {'<<'}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {'<'}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {'>'}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          {'>>'}
        </button>
        <span className="flex items-center gap-1">
          <div>Page</div>
          <strong>
            {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </strong>
        </span>
        <span className="flex items-center gap-1">
          | Go to page:
          <input
            type="number"
            min="1"
            max={table.getPageCount()}
            defaultValue={table.getState().pagination.pageIndex + 1}
            onChange={e => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0
              table.setPageIndex(page)
            }}
            className="border p-1 rounded w-16"
          />
        </span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => {
            table.setPageSize(Number(e.target.value))
          }}
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>
      <div className="h-2" />
      <hr />
      <br />
      <div className="flex flex-col gap-2 align-center vertical">
        <div>
          <input
            type="checkbox"
            checked={keepPinnedRows}
            onChange={() => setKeepPinnedRows(!keepPinnedRows)}
          />
          <label className="ml-2">
            Keep/Persist Pinned Rows across Pagination and Filtering
          </label>
        </div>
        <div>
          <input
            type="checkbox"
            checked={includeLeafRows}
            onChange={() => setIncludeLeafRows(!includeLeafRows)}
          />
          <label className="ml-2">Include Leaf Rows When Pinning Parent</label>
        </div>
        <div>
          <input
            type="checkbox"
            checked={includeParentRows}
            onChange={() => setIncludeParentRows(!includeParentRows)}
          />
          <label className="ml-2">Include Parent Rows When Pinning Child</label>
        </div>
        <div>
          <input
            type="checkbox"
            checked={copyPinnedRows}
            onChange={() => setCopyPinnedRows(!copyPinnedRows)}
          />
          <label className="ml-2">
            Duplicate/Keep Pinned Rows in main table
          </label>
        </div>
      </div>
      <div>
        <button className="border rounded p-2 mb-2" onClick={() => rerender()}>
          Force Rerender
        </button>
      </div>
      <div>
        <button
          className="border rounded p-2 mb-2"
          onClick={() => refreshData()}
        >
          Refresh Data
        </button>
      </div>
      <div>{JSON.stringify(rowPinning, null, 2)}</div>
    </div>
  )
}

function PinnedRow({ row, table }: { row: Row<any>; table: Table<any> }) {
  return (
    <tr
      style={{
        backgroundColor: 'lightblue',
        position: 'sticky',
        top:
          row.getIsPinned() === 'top'
            ? `${row.getPinnedIndex() * 26 + 48}px`
            : undefined,
        bottom:
          row.getIsPinned() === 'bottom'
            ? `${
                (table.getBottomRows().length - 1 - row.getPinnedIndex()) * 26
              }px`
            : undefined,
      }}
    >
      {row.getVisibleCells().map(cell => {
        return (
          <td key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        )
      })}
    </tr>
  )
}

function Filter({
  column,
  table,
}: {
  column: Column<any, any>
  table: Table<any>
}) {
  const firstValue = table
    .getPreFilteredRowModel()
    .flatRows[0]?.getValue(column.id)

  return typeof firstValue === 'number' ? (
    <div className="flex space-x-2">
      <input
        type="number"
        value={((column.getFilterValue() as any)?.[0] ?? '') as string}
        onChange={e =>
          column.setFilterValue((old: any) => [e.target.value, old?.[1]])
        }
        placeholder={`Min`}
        className="w-24 border shadow rounded"
      />
      <input
        type="number"
        value={((column.getFilterValue() as any)?.[1] ?? '') as string}
        onChange={e =>
          column.setFilterValue((old: any) => [old?.[0], e.target.value])
        }
        placeholder={`Max`}
        className="w-24 border shadow rounded"
      />
    </div>
  ) : (
    <input
      type="text"
      value={(column.getFilterValue() ?? '') as string}
      onChange={e => column.setFilterValue(e.target.value)}
      placeholder={`Search...`}
      className="w-36 border shadow rounded"
    />
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
