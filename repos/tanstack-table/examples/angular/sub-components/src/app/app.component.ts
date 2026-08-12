import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core'
import {
  ColumnDef,
  createAngularTable,
  ExpandedState,
  flexRenderComponent,
  FlexRenderDirective,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/angular-table'
import { makeData, type Person } from './makeData'
import { ReactiveFormsModule } from '@angular/forms'
import { ExpandableCell, ExpanderCell } from './expandable-cell'
import { JsonPipe, NgTemplateOutlet } from '@angular/common'

const columns: ColumnDef<Person>[] = [
  {
    header: 'Name',
    footer: props => props.column.id,
    columns: [
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => {
          if (!row.getCanExpand()) {
            return '🔵'
          }
          return flexRenderComponent(ExpanderCell, {
            inputs: {
              expanded: row.getIsExpanded(),
            },
            outputs: {
              click: row.getToggleExpandedHandler(),
            },
          })
        },
      },
      {
        accessorKey: 'firstName',
        header: 'First Name',
        cell: () => flexRenderComponent(ExpandableCell),
        footer: props => props.column.id,
      },
      {
        accessorFn: row => row.lastName,
        id: 'lastName',
        cell: info => info.getValue(),
        header: () => 'Last Name',
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
            header: () => 'Visits',
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

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FlexRenderDirective,
    ReactiveFormsModule,
    JsonPipe,
    NgTemplateOutlet,
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly data = signal<Person[]>(makeData(10))
  readonly expanded = signal<ExpandedState>({})

  readonly table = createAngularTable(() => ({
    data: this.data(),
    columns,
    state: {
      expanded: this.expanded(),
    },
    onExpandedChange: updater =>
      typeof updater === 'function'
        ? this.expanded.update(updater)
        : this.expanded.set(updater),
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  }))
}
