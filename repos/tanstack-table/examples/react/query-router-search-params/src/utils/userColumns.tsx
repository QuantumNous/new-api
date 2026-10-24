import { ColumnDef, RowData } from '@tanstack/react-table'
import { User } from '../api/user'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    filterKey?: keyof TData
    filterVariant?: 'text' | 'number'
  }
}

export const USER_COLUMNS: ColumnDef<User>[] = [
  {
    accessorKey: 'id',
    header: () => <span>ID</span>,
    meta: { filterKey: 'id', filterVariant: 'number' },
  },
  {
    accessorKey: 'firstName',
    header: () => <span>First Name</span>,
    meta: { filterKey: 'firstName' },
  },
  {
    accessorKey: 'lastName',
    header: () => <span>Last Name</span>,
    meta: { filterKey: 'lastName' },
  },
  {
    accessorKey: 'age',
    header: () => 'Age',
    meta: { filterKey: 'age', filterVariant: 'number' },
  },
]
