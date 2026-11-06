import './index.css'

import { createColumnHelper, getCoreRowModel } from '@tanstack/table-core'

import { flexRender, useTable } from './useTable'

type Person = {
  firstName: string
  lastName: string
  age: number
  visits: number
  status: string
  progress: number
}

const data: Person[] = [
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
]

const columnHelper = createColumnHelper<Person>()

const columns = [
  columnHelper.accessor('firstName', {
    cell: info => info.getValue(),
    footer: info => info.column.id,
  }),
  columnHelper.accessor(row => row.lastName, {
    id: 'lastName',
    cell: info => `<i>${info.getValue()}</i>`,
    header: () => '<span>Last Name</span>',
    footer: info => info.column.id,
  }),
  columnHelper.accessor('age', {
    header: () => 'Age',
    cell: info => info.renderValue(),
    footer: info => info.column.id,
  }),
  columnHelper.accessor('visits', {
    header: () => '<span>Visits</span>',
    footer: info => info.column.id,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    footer: info => info.column.id,
  }),
  columnHelper.accessor('progress', {
    header: 'Profile Progress',
    footer: info => info.column.id,
  }),
]

const renderTable = () => {
  // Create table elements
  const tableElement = document.createElement('table')
  const theadElement = document.createElement('thead')
  const tbodyElement = document.createElement('tbody')
  const tfootElement = document.createElement('tfoot')

  tableElement.appendChild(theadElement)
  tableElement.appendChild(tbodyElement)
  tableElement.appendChild(tfootElement)

  // Render table headers
  table.getHeaderGroups().forEach(headerGroup => {
    const trElement = document.createElement('tr')
    headerGroup.headers.forEach(header => {
      const thElement = document.createElement('th')
      thElement.innerHTML = header.isPlaceholder
        ? ''
        : flexRender(header.column.columnDef.header, header.getContext())
      trElement.appendChild(thElement)
    })
    theadElement.appendChild(trElement)
  })

  // Render table rows
  table.getRowModel().rows.forEach(row => {
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

  // Render table footers
  table.getFooterGroups().forEach(footerGroup => {
    const trElement = document.createElement('tr')
    footerGroup.headers.forEach(header => {
      const thElement = document.createElement('th')
      thElement.innerHTML = header.isPlaceholder
        ? ''
        : flexRender(header.column.columnDef.footer, header.getContext())
      trElement.appendChild(thElement)
    })
    tfootElement.appendChild(trElement)
  })

  // Clear previous content and append new content
  const wrapperElement = document.getElementById('wrapper') as HTMLDivElement
  wrapperElement.innerHTML = ''
  wrapperElement.appendChild(tableElement)
}

const table = useTable<Person>({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
})

renderTable()
