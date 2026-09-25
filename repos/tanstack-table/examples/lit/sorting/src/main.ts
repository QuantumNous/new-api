import { customElement } from 'lit/decorators.js'
import { html, LitElement } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { state } from 'lit/decorators/state.js'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingFn,
  type SortingState,
  TableController,
} from '@tanstack/lit-table'

import { makeData, Person } from './makeData'

const sortStatusFn: SortingFn<Person> = (rowA, rowB, _columnId) => {
  const statusA = rowA.original.status
  const statusB = rowB.original.status
  const statusOrder = ['single', 'complicated', 'relationship']
  return statusOrder.indexOf(statusA) - statusOrder.indexOf(statusB)
}

const columns: ColumnDef<Person>[] = [
  {
    accessorKey: 'firstName',
    cell: info => info.getValue(),
    //this column will sort in ascending order by default since it is a string column
  },
  {
    accessorFn: row => row.lastName,
    id: 'lastName',
    cell: info => info.getValue(),
    header: () => html`<span>Last Name</span>`,
    sortUndefined: 'last', //force undefined values to the end
    sortDescFirst: false, //first sort order will be ascending (nullable values can mess up auto detection of sort order)
  },
  {
    accessorKey: 'age',
    header: () => 'Age',
    //this column will sort in descending order by default since it is a number column
  },
  {
    accessorKey: 'visits',
    header: () => html`<span>Visits</span>`,
    sortUndefined: 'last', //force undefined values to the end
  },
  {
    accessorKey: 'status',
    header: 'Status',
    sortingFn: sortStatusFn, //use our custom sorting function for this enum column
  },
  {
    accessorKey: 'progress',
    header: 'Profile Progress',
    // enableSorting: false, //disable sorting for this column
  },
  {
    accessorKey: 'rank',
    header: 'Rank',
    invertSorting: true, //invert the sorting order (golf score-like where smaller is better)
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
    // sortingFn: 'datetime' //make sure table knows this is a datetime column (usually can detect if no null values)
  },
]

const data: Person[] = makeData(1000)

@customElement('lit-table-example')
class LitTableExample extends LitElement {
  @state()
  private _sorting: SortingState = []

  private tableController = new TableController<Person>(this)

  protected render() {
    const table = this.tableController.table({
      columns,
      data,
      state: {
        sorting: this._sorting,
      },
      onSortingChange: updaterOrValue => {
        if (typeof updaterOrValue === 'function') {
          this._sorting = updaterOrValue(this._sorting)
        } else {
          this._sorting = updaterOrValue
        }
      },
      getSortedRowModel: getSortedRowModel(),
      getCoreRowModel: getCoreRowModel(),
    })

    return html`
      <table>
        <thead>
          ${repeat(
            table.getHeaderGroups(),
            headerGroup => headerGroup.id,
            headerGroup => html`
              <tr>
                ${headerGroup.headers.map(
                  header => html`
                    <th colspan="${header.colSpan}">
                      ${header.isPlaceholder
                        ? null
                        : html`<div
                            title=${header.column.getCanSort()
                              ? header.column.getNextSortingOrder() === 'asc'
                                ? 'Sort ascending'
                                : header.column.getNextSortingOrder() === 'desc'
                                  ? 'Sort descending'
                                  : 'Clear sort'
                              : undefined}
                            @click="${header.column.getToggleSortingHandler()}"
                            style="cursor: ${header.column.getCanSort()
                              ? 'pointer'
                              : 'not-allowed'}"
                          >
                            ${flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            ${{ asc: ' 🔼', desc: ' 🔽' }[
                              header.column.getIsSorted() as string
                            ] ?? null}
                          </div>`}
                    </th>
                  `
                )}
              </tr>
            `
          )}
        </thead>
        <tbody>
          ${table
            .getRowModel()
            .rows.slice(0, 10)
            .map(
              row => html`
                <tr>
                  ${row
                    .getVisibleCells()
                    .map(
                      cell => html`
                        <td>
                          ${flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      `
                    )}
                </tr>
              `
            )}
        </tbody>
      </table>
      <pre>${JSON.stringify(this._sorting, null, 2)}</pre>
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
