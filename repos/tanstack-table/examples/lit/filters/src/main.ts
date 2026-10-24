import { customElement, property, state } from 'lit/decorators.js'
import { html, LitElement } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  RowData,
  TableController,
} from '@tanstack/lit-table'
import { makeData, Person } from './makeData'

const columns: ColumnDef<Person, any>[] = [
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
    meta: {
      filterVariant: 'range',
    },
  },
  {
    accessorKey: 'visits',
    header: () => html`<span>Visits</span>`,
    meta: {
      filterVariant: 'range',
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: {
      filterVariant: 'select',
    },
  },
  {
    accessorKey: 'progress',
    header: 'Profile Progress',
    meta: {
      filterVariant: 'range',
    },
  },
]

declare module '@tanstack/lit-table' {
  //allows us to define custom properties for our columns
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: 'text' | 'range' | 'select'
  }
}

const data = makeData(50_000)

@customElement('column-filter')
class ColumnFilter extends LitElement {
  @property()
  private column!: Column<any, {}>

  private onChange(evt: InputEvent) {
    this.column?.setFilterValue((evt.target as HTMLInputElement).value)
  }

  render() {
    const { filterVariant } = this.column.columnDef.meta ?? {}
    const columnFilterValue = this.column.getFilterValue()

    switch (filterVariant) {
      case 'select':
        return html` <select
          @change=${(e: Event) =>
            this.column.setFilterValue((e.target as HTMLSelectElement).value)}
        >
          <option value="">All</option>
          <option value="complicated">complicated</option>
          <option value="relationship">relationship</option>
          <option value="single">single</option>
        </select>`
      case 'range':
        return html`
          <div style="display:flex;gap:2px">
            <input
              type="number"
              placeholder="Min"
              @change="${(e: Event) =>
                this.column.setFilterValue((old: [number, number]) => [
                  parseInt((e.target as HTMLInputElement).value, 10),
                  old?.[1],
                ])}"
              value=${(columnFilterValue as [number, number])?.[0] ?? ''}
            />
            <input
              type="number"
              placeholder="Max"
              @change="${(e: Event) =>
                this.column.setFilterValue((old: [number, number]) => [
                  parseInt((e.target as HTMLInputElement).value, 10),
                  old?.[0],
                ])}"
              value=${(columnFilterValue as [number, number])?.[1] ?? ''}
            />
          </div>
        `
      default:
        return html`<input @input=${this.onChange} />`
    }
    return null
  }
}

@customElement('lit-table-example')
class LitTableExample extends LitElement {
  private tableController = new TableController<Person>(this)

  @state()
  private _columnFilters: ColumnFiltersState = []

  protected render(): unknown {
    const table = this.tableController.table({
      data,
      columns,
      filterFns: {},
      state: {
        columnFilters: this._columnFilters,
      },
      onColumnFiltersChange: updater => {
        if (typeof updater === 'function') {
          this._columnFilters = updater(this._columnFilters)
        } else {
          this._columnFilters = updater
        }
      },
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(), //client side filtering
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      debugTable: true,
      debugHeaders: true,
      debugColumns: false,
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
                        : html`<div
                              title=${header.column.getCanSort()
                                ? header.column.getNextSortingOrder() === 'asc'
                                  ? 'Sort ascending'
                                  : header.column.getNextSortingOrder() ===
                                      'desc'
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
                            </div>
                            ${header.column.getCanFilter()
                              ? html` <div>
                                  <column-filter
                                    .column="${header.column}"
                                  ></column-filter>
                                </div>`
                              : null} `}
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
      <pre>${JSON.stringify(this._columnFilters, null, 2)}</pre>
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
