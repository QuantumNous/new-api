import { ColumnDef } from '@tanstack/angular-table'

export type Person = {
  firstName: string
  lastName: string
  age: number
  visits: number
  progress: number
  status: 'relationship' | 'complicated' | 'single'
  subRows?: Person[]
}

export const columns: ColumnDef<Person>[] = [
  {
    header: 'Name',
    columns: [
      {
        accessorKey: 'firstName',
        header: 'First Name',
        cell: info => info.getValue(),
        /**
         * override the value used for row grouping
         * (otherwise, defaults to the value derived from accessorKey / accessorFn)
         */
        getGroupingValue: row => `${row.firstName} ${row.lastName}`,
      },
      {
        accessorFn: row => row.lastName,
        id: 'lastName',
        header: () => `Last Name`,
        cell: info => info.getValue(),
      },
    ],
  },
  {
    header: 'Info',
    columns: [
      {
        accessorKey: 'age',
        header: () => 'Age',
        aggregatedCell: ({ getValue }) =>
          Math.round(getValue<number>() * 100) / 100,
        aggregationFn: 'median',
      },
      {
        header: 'More Info',
        columns: [
          {
            accessorKey: 'visits',
            header: () => `Visits`,
            aggregationFn: 'sum',
            // aggregatedCell: ({ getValue }) => getValue().toLocaleString(),
          },
          {
            accessorKey: 'status',
            header: 'Status',
          },
          {
            accessorKey: 'progress',
            header: 'Profile Progress',
            cell: ({ getValue }) =>
              Math.round(getValue<number>() * 100) / 100 + '%',
            aggregationFn: 'mean',
            aggregatedCell: ({ getValue }) =>
              Math.round(getValue<number>() * 100) / 100 + '%',
          },
        ],
      },
    ],
  },
]
