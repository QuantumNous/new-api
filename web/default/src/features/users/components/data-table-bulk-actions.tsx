import { type Table } from '@tanstack/react-table'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { type User } from '../types'

interface DataTableBulkActionsProps {
  table: Table<User>
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  return (
    <BulkActionsToolbar table={table} entityName='user'>
      <></>
    </BulkActionsToolbar>
  )
}
