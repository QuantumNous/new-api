import '@builder.io/qwik/qwikloader.js'

import { $, render, useSignal } from '@builder.io/qwik'
import './index.css'

import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  useQwikTable,
  ColumnFiltersState,
  SortingFn,
  FilterFn,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  Column,
  Table,
  sortingFns,
} from '@tanstack/qwik-table'

import { component$ } from '@builder.io/qwik'

import {
  rankItem,
  compareItems,
  RankingInfo,
} from '@tanstack/match-sorter-utils'

declare module '@tanstack/qwik-table' {
  interface FilterFns {
    fuzzy: FilterFn<unknown>
  }
  interface FilterMeta {
    itemRank: RankingInfo
  }
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  // Rank the item
  const itemRank = rankItem(row.getValue(columnId), value)

  // Store the itemRank info
  addMeta({
    itemRank,
  })

  // Return if the item should be filtered in/out
  return itemRank.passed
}

const fuzzySort: SortingFn<any> = (rowA, rowB, columnId) => {
  let dir = 0

  // Only sort by rank if the column has ranking information
  if (rowA.columnFiltersMeta[columnId]) {
    dir = compareItems(
      rowA.columnFiltersMeta[columnId]?.itemRank!,
      rowB.columnFiltersMeta[columnId]?.itemRank!
    )
  }

  // Provide an alphanumeric fallback for when the item ranks are equal
  return dir === 0 ? sortingFns.alphanumeric(rowA, rowB, columnId) : dir
}

type Person = {
  firstName: string
  lastName: string
  age: number
  visits: number
  status: string
  progress: number
}

const defaultData: Person[] = [
  {
    firstName: 'tanner',
    lastName: 'linsley',
    age: 24,
    visits: 100,
    status: 'In Relationship',
    progress: 50,
  },
  {
    firstName: 'tandy',
    lastName: 'miller',
    age: 40,
    visits: 40,
    status: 'Single',
    progress: 80,
  },
  {
    firstName: 'joe',
    lastName: 'dirte',
    age: 45,
    visits: 20,
    status: 'Complicated',
    progress: 10,
  },
  {
    firstName: 'Anxhi',
    lastName: 'Rroshi',
    age: 21,
    visits: 1,
    status: 'Unknown',
    progress: 99,
  },
]

const columnHelper = createColumnHelper<Person>()

const columns = [
  columnHelper.group({
    header: 'Name',
    footer: props => props.column.id,
    columns: [
      columnHelper.accessor('firstName', {
        cell: info => info.getValue(),
        footer: props => props.column.id,
      }),
      columnHelper.accessor(row => row.lastName, {
        id: 'lastName',
        cell: info => info.getValue(),
        header: () => <span>Last Name</span>,
        footer: props => props.column.id,
        sortingFn: fuzzySort,
      }),
      columnHelper.accessor(row => `${row.firstName} ${row.lastName}`, {
        id: 'fullName',
        header: 'Full Name',
        cell: info => info.getValue(),
        footer: props => props.column.id,
        sortingFn: fuzzySort,
      }),
    ],
  }),
  columnHelper.group({
    header: 'Info',
    footer: props => props.column.id,
    columns: [
      columnHelper.accessor('age', {
        header: () => 'Age',
        footer: props => props.column.id,
      }),
      columnHelper.group({
        header: 'More Info',
        columns: [
          columnHelper.accessor('visits', {
            header: () => <span>Visits</span>,
            footer: props => props.column.id,
          }),
          columnHelper.accessor('status', {
            header: 'Status',
            footer: props => props.column.id,
          }),
          columnHelper.accessor('progress', {
            header: 'Profile Progress',
            footer: props => props.column.id,
          }),
        ],
      }),
    ],
  }),
]

const App = component$(() => {
  const columnFilters = useSignal<ColumnFiltersState>([])
  const globalFilter = useSignal('')

  const table = useQwikTable({
    data: defaultData,
    columns,
    enableSorting: true,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    state: {
      columnFilters: columnFilters.value,
      globalFilter: globalFilter.value,
    },
    onColumnFiltersChange: updater => {
      const updated =
        updater instanceof Function ? updater(columnFilters.value) : updater
      columnFilters.value = updated
    },
    onGlobalFilterChange: updater => {
      const updated = updater(globalFilter.value)
      globalFilter.value = updated
    },
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    debugTable: true,
    debugHeaders: true,
    debugColumns: false,
  })

  return (
    <div>
      <div>
        <input
          value={globalFilter.value ?? ''}
          onInput$={$((e: InputEvent) => {
            globalFilter.value = (e.target as HTMLInputElement).value
          })}
          class="p-2 font-lg shadow border border-block"
          placeholder="Search all columns..."
        />
      </div>
      <table class="table">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                return (
                  <th key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <>
                        <div
                          {...{
                            class: header.column.getCanSort()
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
          {table.getRowModel().rows.map(row => {
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div>{table.getPrePaginationRowModel().rows.length} Rows</div>
      <pre>{JSON.stringify(table.getState(), null, 2)}</pre>
    </div>
  )
})

function Filter({
  column,
  table,
}: {
  column: Column<any, unknown>
  table: Table<any>
}) {
  const { id } = column
  const firstValue = table
    .getPreFilteredRowModel()
    .flatRows[0]?.getValue(column.id)

  const columnFilterValue = column.getFilterValue()

  const sortedUniqueValues =
    typeof firstValue === 'number'
      ? []
      : Array.from(column.getFacetedUniqueValues().keys()).sort()

  return typeof firstValue === 'number' ? (
    <div>
      <div class="flex space-x-2" style={{ display: 'flex' }}>
        <input
          type="number"
          min={Number(column.getFacetedMinMaxValues()?.[0] ?? '')}
          max={Number(column.getFacetedMinMaxValues()?.[1] ?? '')}
          value={(columnFilterValue as [number, number])?.[0] ?? ''}
          onInput$={$((e: InputEvent) => {
            const value = Number((e.target as HTMLInputElement).value)
            const myCol = table.getColumn(id)
            myCol?.setFilterValue((old: [number, number]) => [value, old?.[1]])
          })}
          placeholder={`Min ${
            column.getFacetedMinMaxValues()?.[0]
              ? `(${column.getFacetedMinMaxValues()?.[0]})`
              : ''
          }`}
          class="w-24 border shadow rounded"
        />
        <input
          type="number"
          min={Number(column.getFacetedMinMaxValues()?.[0] ?? '')}
          max={Number(column.getFacetedMinMaxValues()?.[1] ?? '')}
          value={(columnFilterValue as [number, number])?.[1] ?? ''}
          onInput$={$((e: InputEvent) => {
            const value = Number((e.target as HTMLInputElement).value)
            const myCol = table.getColumn(id)
            myCol?.setFilterValue((old: [number, number]) => [old?.[0], value])
          })}
          placeholder={`Max ${
            column.getFacetedMinMaxValues()?.[1]
              ? `(${column.getFacetedMinMaxValues()?.[1]})`
              : ''
          }`}
          class="w-24 border shadow rounded"
        />
      </div>
      <div class="h-1" />
    </div>
  ) : (
    <>
      <datalist id={column.id + 'list'}>
        {sortedUniqueValues.slice(0, 5000).map((value: any) => (
          <option value={value} key={value} />
        ))}
      </datalist>
      <input
        type="text"
        value={(columnFilterValue ?? '') as string}
        onInput$={$((e: InputEvent) => {
          const value = (e.target as HTMLInputElement).value
          const myCol = table.getColumn(id)
          myCol?.setFilterValue(value)
          // column.setFilterValue(e.target.value)
        })}
        placeholder={`Search... (${column.getFacetedUniqueValues().size})`}
        // class="w-36 border shadow rounded"
        // list={column.id + 'list'}
      />
      <div class="h-1" />
    </>
  )
}

render(document.getElementById('app') as HTMLElement, <App />)
