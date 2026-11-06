import '@builder.io/qwik/qwikloader.js'
import { render, component$, useSignal, $ } from '@builder.io/qwik'

import './index.css'
import { makeData } from './makeData'

import {
  getCoreRowModel,
  flexRender,
  useQwikTable,
  SortingState,
  ColumnDef,
  getSortedRowModel,
} from '@tanstack/qwik-table'

type Person = {
  firstName: string
  lastName: string
  age: number
  visits: number
  status: string
  progress: number
}

const columns: ColumnDef<Person>[] = [
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
    sortDescFirst: true, // This column will sort in descending order first (default for number columns anyway)
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
    cell: info => info.getValue<Date>().toLocaleDateString(),
    // sortingFn: 'datetime' (inferred from the data)
  },
]

const App = component$(() => {
  const data = useSignal(makeData(10_000))

  const sorting = useSignal<SortingState>([])

  const table = useQwikTable({
    columns,
    data: data.value,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting: true,
    state: {
      sorting: sorting.value,
    },
    onSortingChange: updater => {
      sorting.value =
        updater instanceof Function ? updater(sorting.value) : updater
    },
  })

  return (
    <div class="p-2">
      <table>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                const { column } = header
                const id = column.id
                return (
                  <th key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <div
                        class={
                          column.getCanSort()
                            ? 'cursor-pointer select-none'
                            : ''
                        }
                        onClick$={$(event => {
                          const col = table.getColumn(id)! //avoid serializing errors
                          col.getToggleSortingHandler()!(event)
                        })}
                        title={
                          column.getCanSort()
                            ? column.getNextSortingOrder() === 'asc'
                              ? 'Sort ascending'
                              : column.getNextSortingOrder() === 'desc'
                                ? 'Sort descending'
                                : 'Clear sort'
                            : undefined
                        }
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
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table
            .getRowModel()
            .rows.slice(0, 10)
            .map(row => {
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
        </tbody>
      </table>
      <div>{table.getRowModel().rows.length.toLocaleString()} Rows</div>
      <pre>{JSON.stringify(sorting, null, 2)}</pre>
    </div>
  )
})

render(document.getElementById('app') as HTMLElement, <App />)
