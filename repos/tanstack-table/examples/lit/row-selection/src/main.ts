import { customElement, property, state } from 'lit/decorators.js'
import { html, LitElement } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  TableController,
} from '@tanstack/lit-table'
import { makeData, Person } from './makeData'

const columns: ColumnDef<Person, any>[] = [
  {
    id: 'select',
    header: ({ table }) => html`
      <input
        type="checkbox"
        @change="${table.getToggleAllRowsSelectedHandler()}"
        .checked="${table.getIsAllRowsSelected()}"
        .indeterminate="${table.getIsSomeRowsSelected()}"
      />
    `,
    cell: ({ row }) => html`
      <input
        type="checkbox"
        @change="${row.getToggleSelectedHandler()}"
        .checked="${row.getIsSelected()}"
        ?disabled="${!row.getCanSelect()}"
        .indeterminate="${row.getIsSomeSelected()}"
      />
    `,
  },
  {
    accessorKey: 'firstName',
    cell: info => info.getValue(),
  },
  {
    accessorFn: row => row.lastName,
    id: 'lastName',
    cell: info => info.getValue(),
    header: () => html`<span>Last Name</span>`,
  },
  {
    accessorFn: row => `${row.firstName} ${row.lastName}`,
    id: 'fullName',
    header: 'Full Name',
    cell: info => info.getValue(),
  },
  {
    accessorKey: 'age',
    header: () => 'Age',
  },
  {
    accessorKey: 'visits',
    header: () => html`<span>Visits</span>`,
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
  {
    accessorKey: 'progress',
    header: 'Profile Progress',
  },
]

const data = makeData(50_000)

@customElement('lit-table-example')
class LitTableExample extends LitElement {
  private tableController = new TableController<Person>(this)

  @state()
  private _rowSelection: Record<string, boolean> = {}

  protected render(): unknown {
    const table = this.tableController.table({
      data,
      columns,
      filterFns: {},
      state: {
        rowSelection: this._rowSelection,
      },
      enableRowSelection: true,
      onRowSelectionChange: updaterOrValue => {
        if (typeof updaterOrValue === 'function') {
          this._rowSelection = updaterOrValue(this._rowSelection)
        } else {
          this._rowSelection = updaterOrValue
        }
      },
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      debugTable: true,
    })

    return html`
      <table>
        <thead>
          ${repeat(
            table.getHeaderGroups(),
            headerGroup => headerGroup.id,
            headerGroup => html`
              <tr>
                ${repeat(
                  headerGroup.headers,
                  header => header.id,
                  header => html`
                    <th colspan="${header.colSpan}">
                      ${header.isPlaceholder
                        ? null
                        : html`<div>
                            ${flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
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
      <div class="page-controls">
        <button
          @click=${() => table.setPageIndex(0)}
          ?disabled="${!table.getCanPreviousPage()}"
        >
          <<
        </button>
        <button
          @click=${() => table.previousPage()}
          ?disabled=${!table.getCanPreviousPage()}
        >
          <
        </button>
        <button
          @click=${() => table.nextPage()}
          ?disabled=${!table.getCanNextPage()}
        >
          >
        </button>
        <button
          @click=${() => table.setPageIndex(table.getPageCount() - 1)}
          ?disabled="${!table.getCanNextPage()}"
        >
          >>
        </button>
        <span style="display: flex;gap:2px">
          <span>Page</span>
          <strong>
            ${table.getState().pagination.pageIndex + 1} of
            ${table.getPageCount()}
          </strong>
        </span>
      </div>
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

        .page-controls {
          display: flex;
          gap: 10px;
          padding: 4px 0;
        }
      </style>
    `
  }
}
