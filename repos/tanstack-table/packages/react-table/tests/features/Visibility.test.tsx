import * as React from 'react'
import { describe, expect, it } from 'vitest'
// import { renderHook } from '@testing-library/react-hooks'
import * as RTL from '@testing-library/react'
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from '../../src'

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
    firstName: 'derek',
    lastName: 'perkins',
    age: 40,
    visits: 40,
    status: 'Single',
    progress: 80,
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
    header: 'Name',
    footer: props => props.column.id,
    columns: [
      {
        accessorKey: 'firstName',
        cell: props => props.renderValue(),
        footer: props => props.column.id,
      },
      {
        accessorFn: row => row.lastName,
        id: 'lastName',
        cell: props => props.renderValue(),
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

describe('useReactTable', () => {
  it('can toggle column visibility', () => {
    const Table = () => {
      const [data] = React.useState<Person[]>(() => [...defaultData])
      const [columns] = React.useState<typeof defaultColumns>(() => [
        ...defaultColumns,
      ])
      const [columnVisibility, setColumnVisibility] = React.useState({})

      const rerender = React.useReducer(() => ({}), {})[1]

      const table = useReactTable({
        data,
        columns,
        onColumnVisibilityChange: setColumnVisibility,
        state: {
          columnVisibility,
        },
        getCoreRowModel: getCoreRowModel(),
        // debug: true,
      })

      return (
        <div className="p-2">
          <div className="inline-block border border-black shadow rounded">
            <div className="px-1 border-b border-black">
              <label>
                <input
                  {...{
                    type: 'checkbox',
                    checked: table.getIsAllColumnsVisible(),
                    onChange: table.getToggleAllColumnsVisibilityHandler(),
                  }}
                />{' '}
                Toggle All
              </label>
            </div>
            {table.getAllLeafColumns().map(column => {
              return (
                <div key={column.id} className="px-1">
                  <label>
                    <input
                      {...{
                        type: 'checkbox',
                        checked: column.getIsVisible(),
                        onChange: column.getToggleVisibilityHandler(),
                      }}
                    />{' '}
                    {column.id}
                  </label>
                </div>
              )
            })}
          </div>
          <div className="h-4" />
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              {table.getFooterGroups().map(footerGroup => (
                <tr key={footerGroup.id}>
                  {footerGroup.headers.map(header => (
                    <th key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.footer,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </tfoot>
          </table>
          <div className="h-4" />
          <button onClick={() => rerender()} className="border p-2">
            Rerender
          </button>
        </div>
      )
    }

    // let api: any;

    const rendered = RTL.render(<Table />)

    // RTL.screen.logTestingPlaygroundURL()

    let snapIndex = 0

    const snap = (name: string) => {
      expect({
        headers: Array.from(
          rendered.container.querySelectorAll('thead > tr')
        ).map(d =>
          Array.from(d.querySelectorAll('th')).map(d => [
            d.innerHTML,
            d.getAttribute('colspan'),
          ])
        ),
        rows: Array.from(rendered.container.querySelectorAll('tbody > tr')).map(
          d => Array.from(d.querySelectorAll('td')).map(d => d.innerHTML)
        ),
        footers: Array.from(
          rendered.container.querySelectorAll('tfoot > tr')
        ).map(d =>
          Array.from(d.querySelectorAll('th')).map(d => [
            d.innerHTML,
            d.getAttribute('colspan'),
          ])
        ),
      }).toMatchSnapshot(`${snapIndex++} - ${name}`)
    }

    RTL.fireEvent.click(rendered.getByLabelText('Toggle All'))

    snap('after toggling all off')

    RTL.fireEvent.click(rendered.getByLabelText('Toggle All'))

    snap('after toggling all on')

    RTL.fireEvent.click(rendered.getByLabelText('firstName'))

    snap('after toggling firstName off')

    RTL.fireEvent.click(rendered.getByLabelText('firstName'))
    RTL.fireEvent.click(rendered.getByLabelText('visits'))
    RTL.fireEvent.click(rendered.getByLabelText('status'))
    RTL.fireEvent.click(rendered.getByLabelText('progress'))

    snap('after toggling More Info off')
  })
})
