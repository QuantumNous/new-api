import { expect, test } from 'vitest'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  TableOptions,
  useReactTable,
} from '../../src'
import { fireEvent, render, screen } from '@testing-library/react'
import React, { FC } from 'react'

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
    age: 29,
    visits: 100,
    status: 'In Relationship',
    progress: 50,
  },
  {
    firstName: 'joe',
    lastName: 'bergevin',
    age: 45,
    visits: 20,
    status: 'Complicated',
    progress: 10,
  },
]

const defaultColumns: ColumnDef<Person>[] = [
  {
    id: 'select',
    header: ({ table }) => {
      return (
        <input
          data-testid="select-all"
          aria-checked={table.getIsSomeRowsSelected() ? 'mixed' : undefined}
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      )
    },
    cell: ({ row }) => {
      return (
        <input
          type="checkbox"
          disabled={row.getCanSelect()}
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      )
    },
  },
  {
    header: 'First Name',
    accessorKey: 'firstName',
  },
]
const defaultPaginatedColumns: ColumnDef<Person>[] = [
  {
    id: 'select',
    header: ({ table }) => {
      return (
        <input
          data-testid="select-all-page"
          aria-checked={table.getIsSomePageRowsSelected() ? 'mixed' : undefined}
          type="checkbox"
          disabled
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      )
    },
    cell: ({ row }) => {
      return row.getCanSelect() ? (
        <input
          data-testid="select-single"
          type="checkbox"
          disabled={row.getCanSelect()}
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ) : null
    },
  },
  {
    header: 'First Name',
    accessorKey: 'firstName',
  },
]

const TableComponent: FC<{ options?: Partial<TableOptions<Person>> }> = ({
  options = {},
}) => {
  const table = useReactTable({
    data: defaultData,
    columns: defaultColumns,
    getCoreRowModel: getCoreRowModel(),
    ...options,
  })

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th key={header.id} colSpan={header.colSpan}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id}>
            {row.getVisibleCells().map(cell => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

test(`Select all do not select rows which are not available for selection`, () => {
  render(
    <TableComponent
      options={{ enableRowSelection: row => row.original.age > 40 }}
    />
  )

  const [title, notSelected, selected] = screen.getAllByRole('checkbox')

  // Let's trigger a select all
  fireEvent.click(screen.getByTestId('select-all'))

  // Assert everything - except the not available - is selected
  expect(title).toBePartiallyChecked()
  expect(notSelected).not.toBeChecked()
  expect(selected).toBeChecked()

  // Let's unselect all
  fireEvent.click(screen.getByTestId('select-all'))

  // Now everything is unchecked again
  expect(title).not.toBePartiallyChecked()
  expect(notSelected).not.toBeChecked()
  expect(selected).not.toBeChecked()
})

// issue #4757
test(`Select all is unchecked for current page if all rows are not available for selection`, () => {
  let condition = row => row.original.age > 50

  const { rerender } = render(
    <TableComponent
      options={{
        columns: defaultPaginatedColumns,
        data: defaultData,
        enableRowSelection: condition,
      }}
    />
  )

  expect(screen.queryByTestId('select-single')).not.toBeInTheDocument()
  let selectedOnPage = screen.getByTestId('select-all-page')
  expect(selectedOnPage).not.toBeChecked()
  expect(selectedOnPage).not.toHaveAttribute('aria-checked', 'mixed')

  condition = row => row.original.age > 40
  rerender(
    <TableComponent
      options={{
        columns: defaultPaginatedColumns,
        data: defaultData,
        enableRowSelection: condition,
      }}
    />
  )

  expect(screen.queryByTestId('select-single')).toBeInTheDocument()
  selectedOnPage = screen.getByTestId('select-all-page')
  expect(selectedOnPage).not.toBeChecked()
  expect(selectedOnPage).not.toHaveAttribute('aria-checked', 'mixed')

  fireEvent.click(screen.queryByTestId('select-single'))
  expect(selectedOnPage).toBeChecked()
})

test(`Select all when all rows are available for selection`, () => {
  render(<TableComponent />)

  const [title, rowOne, rowTwo] = screen.getAllByRole('checkbox')

  // Let's trigger a select all
  fireEvent.click(screen.getByTestId('select-all'))

  // Assert all the rows are selected
  expect(title).toBeChecked()
  expect(rowOne).toBeChecked()
  expect(rowTwo).toBeChecked()

  // Let's unselect all
  fireEvent.click(screen.getByTestId('select-all'))

  // Now everything is unchecked again
  expect(title).not.toBeChecked()
  expect(rowOne).not.toBeChecked()
  expect(rowTwo).not.toBeChecked()
})

test(`Select a single row`, () => {
  render(<TableComponent />)

  const [title, rowOne, rowTwo] = screen.getAllByRole('checkbox')

  // Let's trigger a select in row one
  fireEvent.click(rowOne)

  // Assert only the row we've clicked before is selected
  expect(title).toBePartiallyChecked()
  expect(rowOne).toBeChecked()
  expect(rowTwo).not.toBeChecked()

  // Let's unselect the row one
  fireEvent.click(rowOne)

  // Now everything is unchecked again
  expect(title).not.toBeChecked()
  expect(rowOne).not.toBeChecked()
  expect(rowTwo).not.toBeChecked()
})
