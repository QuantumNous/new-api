import { customElement } from 'lit/decorators.js'
import { html, LitElement } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { state } from 'lit/decorators/state.js'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  TableController,
} from '@tanstack/lit-table'

import { makeData, Person } from './makeData'

const columns: ColumnDef<Person>[] = [
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
  {
    accessorKey: 'rank',
    header: 'Rank',
    invertSorting: true, //invert the sorting order (golf score-like where smaller is better)
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
  },
]

const data: Person[] = makeData(1000)

@customElement('lit-table-example')
class LitTableExample extends LitElement {
  @state()
  private tableController = new TableController<Person>(this)

  protected render() {
    const table = this.tableController.table({
      data,
      columns,
      columnResizeMode: 'onChange',
      columnResizeDirection: 'ltr',
      getCoreRowModel: getCoreRowModel(),
      debugTable: true,
      debugHeaders: true,
      debugColumns: true,
    })

    return html`
      <table style="width: ${table.getCenterTotalSize()}px">
        <thead>
          ${repeat(
            table.getHeaderGroups(),
            headerGroup => headerGroup.id,
            headerGroup => html`
              <tr>
                ${headerGroup.headers.map(
                  header => html`
                    <th
                      colspan="${header.colSpan}"
                      style="width: ${header.getSize()}px"
                    >
                      ${flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      ${header.isPlaceholder
                        ? null
                        : html`<div
                            class="resizer ${table.options
                              .columnResizeDirection} ${header.column.getIsResizing()
                              ? 'is-resizing'
                              : ''}"
                            @dblclick="${() => header.column.resetSize()}"
                            @mousedown="${header.getResizeHandler()}"
                            @touchstart="${header.getResizeHandler()}"
                          />`}
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
      <pre>
${JSON.stringify(
          {
            columnSizing: table.getState().columnSizing,
            columnSizingInfo: table.getState().columnSizingInfo,
          },
          null,
          2
        )}</pre
      >
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

        th,
        td {
          border-bottom: 1px solid lightgray;
          border-right: 1px solid lightgray;
          padding: 2px 4px;
        }

        th {
          padding: 2px 4px;
          position: relative;
          font-weight: bold;
          text-align: center;
          height: 30px;
        }

        tfoot {
          color: gray;
        }

        tfoot th {
          font-weight: normal;
        }
        .resizer {
          position: absolute;
          top: 0;
          height: 100%;
          width: 5px;
          background: rgba(0, 0, 0, 0.5);
          cursor: col-resize;
          user-select: none;
          touch-action: none;
        }

        .resizer.ltr {
          right: 0;
        }

        .resizer.rtl {
          left: 0;
        }

        .resizer.is-resizing {
          background: blue;
          opacity: 1;
        }

        @media (hover: hover) {
          .resizer {
            opacity: 0;
          }

          *:hover > .resizer {
            opacity: 1;
          }
        }
      </style>
    `
  }
}
