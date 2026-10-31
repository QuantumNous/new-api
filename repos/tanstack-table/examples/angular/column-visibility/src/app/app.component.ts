import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type OnInit,
  signal,
} from '@angular/core'
import {
  ColumnDef,
  createAngularTable,
  FlexRenderDirective,
  getCoreRowModel,
  type VisibilityState,
} from '@tanstack/angular-table'

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
]

const defaultColumns: ColumnDef<Person>[] = [
  {
    header: 'Name',
    footer: props => props.column.id,
    columns: [
      {
        accessorKey: 'firstName',
        cell: info => info.getValue(),
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
  imports: [FlexRenderDirective],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  data = signal<Person[]>([])
  readonly columnVisibility = signal<VisibilityState>({})

  table = createAngularTable(() => ({
    data: this.data(),
    columns: defaultColumns,
    state: {
      columnVisibility: this.columnVisibility(),
    },
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: updaterOrValue => {
      const visibilityState =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(this.columnVisibility())
          : updaterOrValue
      this.columnVisibility.set(visibilityState)
    },
    debugTable: true,
    debugHeaders: true,
    debugColumns: true,
  }))

  stringifiedColumnVisibility = computed(() => {
    return JSON.stringify(this.table.getState().columnVisibility)
  })

  ngOnInit() {
    this.data.set(defaultData)
  }

  rerender() {
    this.data.set(defaultData)
  }
}
