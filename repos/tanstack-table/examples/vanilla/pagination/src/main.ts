import './index.css'

import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
} from '@tanstack/table-core'

import { makeData, Person } from './makeData'
import { flexRender, useTable } from './useTable'

const data = makeData(100000)

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

  // Render pagination
  const paginationElement = document.createElement('div')
  paginationElement.classList.add('flex', 'items-center', 'gap-2')

  // Render pagination first page button
  const firstPageButton = document.createElement('button')
  firstPageButton.classList.add('border', 'rounded', 'p-1')
  firstPageButton.disabled = !table.getCanPreviousPage()
  firstPageButton.innerHTML = '<<'
  firstPageButton.onclick = () => table.firstPage()
  paginationElement.appendChild(firstPageButton)

  // Render pagination previous page button
  const prevPageButton = document.createElement('button')
  prevPageButton.classList.add('border', 'rounded', 'p-1')
  prevPageButton.disabled = !table.getCanPreviousPage()
  prevPageButton.innerHTML = '<'
  prevPageButton.onclick = () => table.previousPage()
  paginationElement.appendChild(prevPageButton)

  // Render pagination next page button
  const nextPageButton = document.createElement('button')
  nextPageButton.classList.add('border', 'rounded', 'p-1')
  nextPageButton.disabled = !table.getCanNextPage()
  nextPageButton.innerHTML = '>'
  nextPageButton.onclick = () => table.nextPage()
  paginationElement.appendChild(nextPageButton)

  // Render pagination last page button
  const lastPageButton = document.createElement('button')
  lastPageButton.classList.add('border', 'rounded', 'p-1')
  lastPageButton.disabled = !table.getCanNextPage()
  lastPageButton.innerHTML = '>>'
  lastPageButton.onclick = () => table.lastPage()
  paginationElement.appendChild(lastPageButton)

  // Render pagination info
  const paginationInfoElement = document.createElement('span')
  paginationInfoElement.classList.add('flex', 'items-center', 'gap-1')
  paginationInfoElement.innerHTML = `<div>Page</div><strong>${table.getState().pagination.pageIndex + 1} of ${table.getPageCount().toLocaleString()}</strong>`
  paginationElement.appendChild(paginationInfoElement)

  // Render pagination set page
  const paginationPageElement = document.createElement('span')
  paginationPageElement.classList.add('flex', 'items-center', 'gap-1')
  paginationPageElement.textContent = '| Go to page:'
  const paginationPageInput = document.createElement('input')
  paginationPageInput.type = 'number'
  paginationPageInput.min = String(1)
  paginationPageInput.max = String(table.getPageCount())
  paginationPageInput.defaultValue = String(
    table.getState().pagination.pageIndex + 1
  )
  paginationPageInput.classList.add('border', 'p-1', 'rounded', 'w-16')
  paginationPageInput.oninput = e => {
    const target = e.target as HTMLInputElement
    const page = target.value ? Number(target.value) - 1 : 0
    table.setPageIndex(page)
  }
  paginationPageElement.appendChild(paginationPageInput)
  paginationElement.appendChild(paginationPageElement)

  // Render pagiantion page size
  const paginationPageSizeSelect = document.createElement('select')
  paginationPageSizeSelect.value = String(table.getState().pagination.pageSize)
  paginationPageSizeSelect.onchange = e => {
    const target = e.target as HTMLSelectElement
    table.setPageSize(Number(target.value))
  }
  ;[10, 20, 30, 40, 50].map(pageSize => {
    const option = document.createElement('option')
    option.value = String(pageSize)
    option.selected = table.getState().pagination.pageSize === pageSize
    option.textContent = `Show ${pageSize}`
    paginationPageSizeSelect.appendChild(option)
  })
  paginationElement.appendChild(paginationPageSizeSelect)

  // Render table state info
  const stateInfoElement = document.createElement('pre')
  stateInfoElement.textContent = JSON.stringify(
    {
      pagination: table.getState().pagination,
      sorting: table.getState().sorting,
    },
    null,
    2
  )

  // Clear previous content and append new content
  const wrapperElement = document.getElementById('wrapper') as HTMLDivElement
  wrapperElement.innerHTML = ''
  wrapperElement.appendChild(tableElement)
  wrapperElement.appendChild(paginationElement)
  wrapperElement.appendChild(stateInfoElement)
}

const table = useTable<Person>({
  data,
  columns,
  initialState: {
    pagination: {
      pageSize: 10,
    },
    sorting: [
      {
        id: 'lastName',
        desc: false,
      },
    ],
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  onStateChange: () => renderTable(),
})

renderTable()
