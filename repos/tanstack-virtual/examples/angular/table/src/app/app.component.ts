import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  signal,
  viewChild,
} from '@angular/core'
import { injectVirtualizer } from '@tanstack/angular-virtual'
import {
  ColumnDef,
  createAngularTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  FlexRenderDirective,
  SortDirection,
} from '@tanstack/angular-table'
import { makeData, type Person } from './make-data'

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FlexRenderDirective],
  template: `
    <p>
      For tables, the basis for the offset of the translate css function is from
      the row's initial position itself. Because of this, we need to calculate
      the translateY pixel count different and base it off the the index.
    </p>
    <br />

    <div #scrollElement class="list scroll-container">
      <div [style.height.px]="virtualizer.getTotalSize()">
        <table>
          <thead>
            @for (
              headerGroup of table.getHeaderGroups();
              track headerGroup.id
            ) {
              <tr>
                @for (header of headerGroup.headers; track header.id) {
                  <th
                    [attr.colspan]="header.colSpan"
                    [style.width.px]="header.getSize()"
                  >
                    @if (!header.isPlaceholder) {
                      <div
                        [class.cursor-pointer]="header.column.getCanSort()"
                        [class.select-none]="header.column.getCanSort()"
                        (click)="
                          header.column.getToggleSortingHandler()?.($event)
                        "
                      >
                        <ng-container
                          *flexRender="
                            header.column.columnDef.header;
                            props: header.getContext();
                            let headerText
                          "
                        >
                          <span>{{ headerText }}</span>
                          {{ getSortIcon(header.column.getIsSorted()) }}
                        </ng-container>
                      </div>
                    }
                  </th>
                }
              </tr>
            }
          </thead>
          <tbody>
            @for (
              virtualRow of virtualizer.getVirtualItems();
              track data[virtualRow.index].id
            ) {
              <tr
                [style.height.px]="virtualRow.size"
                [style.transform]="
                  'translateY(' +
                  (virtualRow.start - $index * virtualRow.size) +
                  'px)'
                "
              >
                @for (
                  cell of rows()[virtualRow.index].getVisibleCells();
                  track cell.id
                ) {
                  <td>
                    <ng-container
                      *flexRender="
                        cell.column.columnDef.cell;
                        props: cell.getContext();
                        let cellText
                      "
                    >
                      <span>{{ cellText }}</span>
                    </ng-container>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .scroll-container {
      height: 600px;
      overflow: auto;
    }
  `,
})
export class AppComponent {
  data = makeData(50_000)

  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  sorting = signal<SortingState>([])

  sortIcons = { asc: '🔼', desc: '🔽' }

  getSortIcon(sorting: false | SortDirection) {
    return sorting ? this.sortIcons[sorting] : null
  }

  columns: ColumnDef<Person>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      size: 60,
    },
    {
      accessorKey: 'firstName',
      cell: (info) => info.getValue(),
    },
    {
      accessorFn: (row) => row.lastName,
      id: 'lastName',
      cell: (info) => info.getValue(),
      header: 'Last Name',
    },
    {
      accessorKey: 'age',
      header: () => 'Age',
      size: 50,
    },
    {
      accessorKey: 'visits',
      header: 'Visits',
      size: 50,
    },
    {
      accessorKey: 'status',
      header: 'Status',
    },
    {
      accessorKey: 'progress',
      header: 'Profile Progress',
      size: 80,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      cell: (info) => info.getValue<Date>().toLocaleString(),
    },
  ]

  table = createAngularTable(() => ({
    data: this.data,
    columns: this.columns,
    state: {
      sorting: this.sorting(),
    },
    onSortingChange: (updaterOrValue) =>
      typeof updaterOrValue === 'function'
        ? this.sorting.update(updaterOrValue)
        : this.sorting.set(updaterOrValue),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: true,
  }))

  rows = computed(() => this.table.getRowModel().rows)

  virtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: this.data.length,
    estimateSize: () => 34,
    overscan: 20,
  }))
}
