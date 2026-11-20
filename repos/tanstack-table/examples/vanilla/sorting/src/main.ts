import './index.css'

import {
  type SortingFn,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/table-core'

import { makeData, Person } from './makeData'
import { flexRender, useTable } from './useTable'

const data = makeData(1000)

// Custom sorting logic for one of our enum columns
const sortStatusFn: SortingFn<Person> = (rowA, rowB, _columnId) => {
  const statusA = rowA.original.status
  const statusB = rowB.original.status
  const statusOrder = ['single', 'complicated', 'relationship']
  return statusOrder.indexOf(statusA) - statusOrder.indexOf(statusB)
}

const columnHelper = createColumnHelper<Person>()

const columns = [
  columnHelper.accessor('firstName', {
    cell: info => info.getValue(),
    // This column will sort in ascending order by default since it is a string column
  }),
  columnHelper.accessor(row => row.lastName, {
    id: 'lastName',
    cell: info => `<i>${info.getValue()}</i>`,
    header: () => '<span>Last Name</span>',
    sortUndefined: 'last', // Force undefined values to the end
    sortDescFirst: false, // First sort order will be ascending (nullable values can mess up auto detection of sort order)
  }),
  columnHelper.accessor('age', {
    header: () => 'Age',
    cell: info => info.renderValue(),
    // This column will sort in descending order by default since it is a number column
  }),
  columnHelper.accessor('visits', {
    header: () => '<span>Visits</span>',
    sortUndefined: 'last', // Force undefined values to the end
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    sortingFn: sortStatusFn, // Use our custom sorting function for this enum column
  }),
  columnHelper.accessor('progress', {
    header: 'Profile Progress',
    enableSorting: false, // Disable sorting for this column
  }),
  columnHelper.accessor('rank', {
    header: 'Rank',
    invertSorting: true, // Invert the sorting order (golf score-like where smaller is better)
  }),
  columnHelper.accessor('createdAt', {
    header: 'Created At',
  }),
]

const renderTable = () => {
  // Create table elements
  const tableElement = document.createElement('table')
  const theadElement = document.createElement('thead')
  const tbodyElement = document.createElement('tbody')

  tableElement.classList.add('mb-2')

  tableElement.appendChild(theadElement)
  tableElement.appendChild(tbodyElement)

  // Render table headers
  table.getHeaderGroups().forEach(headerGroup => {
    const trElement = document.createElement('tr')
    headerGroup.headers.forEach(header => {
      const thElement = document.createElement('th')
      thElement.colSpan = header.colSpan
      const divElement = document.createElement('div')
      divElement.classList.add(
        'w-36',
        ...(header.column.getCanSort() ? ['cursor-pointer', 'select-none'] : [])
      )
      ;(divElement.onclick = e => header.column.getToggleSortingHandler()?.(e)),
        (divElement.innerHTML = header.isPlaceholder
          ? ''
          : flexRender(header.column.columnDef.header, header.getContext()))
      divElement.innerHTML +=
        {
          asc: ' 🔼',
          desc: ' 🔽',
        }[header.column.getIsSorted() as string] ?? ''
      thElement.appendChild(divElement)
      trElement.appendChild(thElement)
    })
    theadElement.appendChild(trElement)
  })

  // Render table rows
  table
    .getRowModel()
    .rows.slice(0, 10)
    .forEach(row => {
      const trElement = document.createElement('tr')
      row.getVisibleCells().forEach(cell => {
        const tdElement = document.createElement('td')
        tdElement.innerHTML = flexRender(
          cell.column.columnDef.cell,
          cell.getContext()
        )
        trElement.appendChild(tdElement)
      })
      tbodyElement.appendChild(trElement)
    })

  // Render table state info
  const stateInfoElement = document.createElement('pre')
  stateInfoElement.textContent = JSON.stringify(
    {
      sorting: table.getState().sorting,
    },
    null,
    2
  )

  // Clear previous content and append new content
  const wrapperElement = document.getElementById('wrapper') as HTMLDivElement
  wrapperElement.innerHTML = ''
  wrapperElement.appendChild(tableElement)
  wrapperElement.appendChild(stateInfoElement)
}

const table = useTable<Person>({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  onStateChange: () => renderTable(),
})

renderTable()
