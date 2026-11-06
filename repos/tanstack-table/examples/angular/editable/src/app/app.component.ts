import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  signal,
} from '@angular/core'
import {
  ColumnDef,
  createAngularTable,
  flexRenderComponent,
  FlexRenderDirective,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type RowData,
} from '@tanstack/angular-table'
import { EditableCell } from './editable-cell'
import { makeData, type Person } from './makeData'

declare module '@tanstack/angular-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void
  }
}

const defaultColumn: Partial<ColumnDef<Person>> = {
  cell: ({ getValue, row, column, table }) => {
    const initialValue = getValue()

    return flexRenderComponent(EditableCell, {
      inputs: {
        value: initialValue,
      },
      outputs: {
        blur: value => {
          if (table.options.meta?.updateData) {
            table.options.meta.updateData(row.index, column.id, value)
          }
        },
      },
    })
  },
}

const defaultColumns: ColumnDef<Person>[] = [
  {
    accessorKey: 'firstName',
    footer: info => info.column.id,
  },
  {
    accessorFn: row => row.lastName,
    id: 'lastName',
    header: () => `<span>Last Name</span>`,
    footer: info => info.column.id,
  },
  {
    accessorKey: 'age',
    header: () => 'Age',
    footer: info => info.column.id,
  },
  {
    accessorKey: 'visits',
    header: () => `<span>Visits</span>`,
    footer: info => info.column.id,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    footer: info => info.column.id,
  },
  {
    accessorKey: 'progress',
    header: 'Profile Progress',
    footer: info => info.column.id,
  },
]

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FlexRenderDirective],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly data = signal<Person[]>(makeData(10_000))
  readonly injector = inject(Injector)

  readonly autoResetPageIndex = signal(true)

  readonly table = createAngularTable(() => ({
    data: this.data(),
    columns: defaultColumns,
    defaultColumn: defaultColumn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: true,
    autoResetPageIndex: this.autoResetPageIndex(),
    // Provide our updateData function to our table meta
    meta: {
      updateData: (rowIndex, columnId, value) => {
        // Skip page index reset until after next rerender
        this.autoResetPageIndex.set(false)

        this.data.update(old =>
          old.map((row, index) => {
            if (index === rowIndex) {
              return {
                ...old[rowIndex],
                [columnId]: value,
              }
            }
            return row
          })
        )

        afterNextRender(() => this.autoResetPageIndex.set(true), {
          injector: this.injector,
        })
      },
    },
  }))

  refresh() {
    this.data.set(makeData(10_000))
  }
}
