import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
} from '@tanstack/angular-table'
import { DragHandleCell } from './drag-handle-cell'
import { makeData, type Person } from './makeData'
import {
  CdkDrag,
  type CdkDragDrop,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop'
import { JsonPipe } from '@angular/common'

const defaultColumns: ColumnDef<Person>[] = [
  {
    id: 'drag-handle',
    header: 'Move',
    cell: () => flexRenderComponent(DragHandleCell),
    size: 60,
  },
  {
    accessorKey: 'firstName',
    cell: info => info.getValue(),
  },
  {
    accessorFn: row => row.lastName,
    id: 'lastName',
    cell: info => info.getValue(),
    header: () => `Last Name`,
  },
  {
    accessorKey: 'age',
    header: () => 'Age',
  },
  {
    accessorKey: 'visits',
    header: () => `Visits`,
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

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FlexRenderDirective, CdkDropList, CdkDrag, JsonPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly data = signal<Person[]>(makeData(20))

  readonly table = createAngularTable(() => {
    return {
      data: this.data(),
      columns: defaultColumns,
      getRowId: row => row.userId, //required because row indexes will change
      debugTable: true,
      debugHeaders: true,
      debugColumns: true,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
    }
  })

  readonly sortedIds = computed(() => this.data().map(data => data.userId))

  drop(event: CdkDragDrop<Person[]>) {
    const data = [...this.data()]
    moveItemInArray(data, event.previousIndex, event.currentIndex)
    this.data.set(data)
  }
}
