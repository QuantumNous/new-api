import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  ColumnDef,
  ColumnFiltersState,
  createSolidTable,
} from '@tanstack/solid-table'
import { debounce } from '@solid-primitives/scheduled'
import { makeData, Person } from './makeData'
import ColumnFilter from './ColumnFilter'
import { createSignal, For } from 'solid-js'

const columns: ColumnDef<Person>[] = [
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
        header: 'More Info',
        columns: [
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
    ],
  },
]

function App() {
  const [data, setData] = createSignal(makeData(50000))
  const [columnFilters, setColumnFilters] = createSignal<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = createSignal('')
  const debounceSetGlobalFilter = debounce(
    (value: string) => setGlobalFilter(value),
    500
  )
  const refreshData = () => setData(makeData(50000))

  const table = createSolidTable({
    get data() {
      return data()
    },
    columns,
    state: {
      get columnFilters() {
        return columnFilters()
      },
      get globalFilter() {
        return globalFilter()
      },
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    debugTable: true,
    debugHeaders: true,
    debugColumns: false,
  })

  return (
    <div class="p-2">
      <input
        class="p-2 font-lg shadow border border-block"
        value={globalFilter() ?? ''}
        onInput={e => debounceSetGlobalFilter(e.currentTarget.value)}
        placeholder="Search all columns..."
      />
      <div className="h-2" />
      <table>
        <thead>
          <For each={table.getHeaderGroups()}>
            {headerGroup => (
              <tr>
                <For each={headerGroup.headers}>
                  {header => (
                    <th colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : (
                        <>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanFilter() ? (
                            <div>
                              <ColumnFilter
                                column={header.column}
                                table={table}
                              />
                            </div>
                          ) : null}
                        </>
                      )}
                    </th>
                  )}
                </For>
              </tr>
            )}
          </For>
        </thead>
        <tbody>
          <For each={table.getRowModel().rows.slice(0, 10)}>
            {row => (
              <tr>
                <For each={row.getVisibleCells()}>
                  {cell => (
                    <td>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <div>{table.getRowModel().rows.length} Rows</div>
      <div>
        <button onClick={() => refreshData()}>Refresh Data</button>
      </div>
      <pre>{JSON.stringify(table.getState(), null, 2)}</pre>
    </div>
  )
}

export default App
