import React from 'react'
import ReactDOM from 'react-dom/client'

import './index.css'

import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
  Table,
} from '@tanstack/react-table'
import { makeData } from './makeData'

type Person = {
  firstName: string
  lastName: string
  age: number
  visits: number
  status: string
  progress: number
}

const defaultColumns: ColumnDef<Person>[] = [
  {
    header: 'Name',
    footer: props => props.column.id,
    columns: [
      {
        accessorKey: 'firstName',
        cell: info => info.getValue(),
        footer: props => props.column.id,
      },
      {
        accessorFn: row => row.lastName,
        id: 'lastName',
        cell: info => info.getValue(),
        header: () => <span>Last Name</span>,
        footer: props => props.column.id,
      },
    ],
  },
  {
    header: 'Info',
    footer: props => props.column.id,
    columns: [
      {
        accessorKey: 'age',
        header: () => 'Age',
        footer: props => props.column.id,
      },
      {
        accessorKey: 'visits',
        header: () => <span>Visits</span>,
        footer: props => props.column.id,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        footer: props => props.column.id,
      },
      {
        accessorKey: 'progress',
        header: 'Profile Progress',
        footer: props => props.column.id,
      },
    ],
  },
]

function App() {
  const [data, _setData] = React.useState(() => makeData(200))
  const [columns] = React.useState<typeof defaultColumns>(() => [
    ...defaultColumns,
  ])

  const rerender = React.useReducer(() => ({}), {})[1]

  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      minSize: 60,
      maxSize: 800,
    },
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    debugTable: true,
    debugHeaders: true,
    debugColumns: true,
  })

  /**
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   */
  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders()
    const colSizes: { [key: string]: number } = {}
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!
      colSizes[`--header-${header.id}-size`] = header.getSize()
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize()
    }
    return colSizes
  }, [table.getState().columnSizingInfo, table.getState().columnSizing])

  //demo purposes
  const [enableMemo, setEnableMemo] = React.useState(true)

  return (
    <div className="p-2">
      <i>
        This example has artificially slow cell renders to simulate complex
        usage
      </i>
      <div className="h-4" />
      <label>
        Memoize Table Body:{' '}
        <input
          type="checkbox"
          checked={enableMemo}
          onChange={() => setEnableMemo(!enableMemo)}
        />
      </label>
      <div className="h-4" />
      <button onClick={() => rerender()} className="border p-2">
        Rerender
      </button>
      <pre style={{ minHeight: '10rem' }}>
        {JSON.stringify(
          {
            columnSizing: table.getState().columnSizing,
          },
          null,
          2
        )}
      </pre>
      <div className="h-4" />({data.length} rows)
      <div className="overflow-x-auto">
        {/* Here in the <table> equivalent element (surrounds all table head and data cells), we will define our CSS variables for column sizes */}
        <div
          {...{
            className: 'divTable',
            style: {
              ...columnSizeVars, //Define column sizes on the <table> element
              width: table.getTotalSize(),
            },
          }}
        >
          <div className="thead">
            {table.getHeaderGroups().map(headerGroup => (
              <div
                {...{
                  key: headerGroup.id,
                  className: 'tr',
                }}
              >
                {headerGroup.headers.map(header => (
                  <div
                    {...{
                      key: header.id,
                      className: 'th',
                      style: {
                        width: `calc(var(--header-${header?.id}-size) * 1px)`,
                      },
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    <div
                      {...{
                        onDoubleClick: () => header.column.resetSize(),
                        onMouseDown: header.getResizeHandler(),
                        onTouchStart: header.getResizeHandler(),
                        className: `resizer ${
                          header.column.getIsResizing() ? 'isResizing' : ''
                        }`,
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* When resizing any column we will render this special memoized version of our table body */}
          {table.getState().columnSizingInfo.isResizingColumn && enableMemo ? (
            <MemoizedTableBody table={table} />
          ) : (
            <TableBody table={table} />
          )}
        </div>
      </div>
    </div>
  )
}

//un-memoized normal table body component - see memoized version below
function TableBody({ table }: { table: Table<Person> }) {
  return (
    <div
      {...{
        className: 'tbody',
      }}
    >
      {table.getRowModel().rows.map(row => (
        <div
          {...{
            key: row.id,
            className: 'tr',
          }}
        >
          {row.getVisibleCells().map(cell => {
            //simulate expensive render
            for (let i = 0; i < 10000; i++) {
              Math.random()
            }

            return (
              <div
                {...{
                  key: cell.id,
                  className: 'td',
                  style: {
                    width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                  },
                }}
              >
                {cell.renderValue<any>()}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

//special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = React.memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
