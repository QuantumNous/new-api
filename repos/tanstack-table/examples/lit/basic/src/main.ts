import { customElement } from 'lit/decorators.js'
import { html, LitElement } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  TableController,
} from '@tanstack/lit-table'
import install from '@twind/with-web-components'
import config from '../twind.config'

const withTwind = install(config)

type Person = {
  firstName: string
  lastName: string
  age: number
  visits: number
  status: string
  progress: number
}

const columnHelper = createColumnHelper<Person>()

const columns = [
  columnHelper.accessor('firstName', {
    cell: info => info.getValue(),
    footer: info => info.column.id,
  }),
  columnHelper.accessor(row => row.lastName, {
    id: 'lastName',
    cell: info => html`<i>${info.getValue()}</i>`,
    header: () => html`<span>Last Name</span>`,
    footer: info => info.column.id,
  }),
  columnHelper.accessor('age', {
    header: () => 'Age',
    cell: info => info.renderValue(),
    footer: info => info.column.id,
  }),
  columnHelper.accessor('visits', {
    header: () => html`<span>Visits</span>`,
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
  {
    firstName: 'mor',
    lastName: 'kadosh',
    age: 31,
    visits: 30,
    status: 'In Relationship',
    progress: 90,
  },
]

@customElement('lit-table-example')
@withTwind
class LitTableExample extends LitElement {
  private tableController = new TableController<Person>(this)

  protected render(): unknown {
    const table = this.tableController.table({
      columns,
      data,
      getCoreRowModel: getCoreRowModel(),
    })

    return html`
      <table>
        <thead>
          ${repeat(
            table.getHeaderGroups(),
            headerGroup => headerGroup.id,
            headerGroup =>
              html`${repeat(
                headerGroup.headers,
                header => header.id,
                header =>
                  html` <th>
                    ${header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>`
              )}`
          )}
        </thead>
        <tbody>
          ${repeat(
            table.getRowModel().rows,
            row => row.id,
            row => html`
              <tr>
                ${repeat(
                  row.getVisibleCells(),
                  cell => cell.id,
                  cell =>
                    html` <td>
                      ${flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>`
                )}
              </tr>
            `
          )}
        </tbody>
        <tfoot>
          ${repeat(
            table.getFooterGroups(),
            footerGroup => footerGroup.id,
            footerGroup => html`
              <tr>
                ${repeat(
                  footerGroup.headers,
                  header => header.id,
                  header => html`
                    <th>
                      ${header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.footer,
                            header.getContext()
                          )}
                    </th>
                  `
                )}
              </tr>
            `
          )}
        </tfoot>
      </table>
      <style>
        * {
          font-family: sans-serif;
          font-size: 14px;
          box-sizing: border-box;
        }

        table {
          border: 1px solid lightgray;
          border-collapse: collapse;
        }

        tbody {
          border-bottom: 1px solid lightgray;
        }

        th {
          border-bottom: 1px solid lightgray;
          border-right: 1px solid lightgray;
          padding: 2px 4px;
        }

        tfoot {
          color: gray;
        }

        tfoot th {
          font-weight: normal;
        }
      </style>
    `
  }
}
