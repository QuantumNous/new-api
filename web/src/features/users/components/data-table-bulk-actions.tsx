import { type Table } from '@tanstack/react-table'
import { Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type User } from '../data/schema'
import { useUsers } from './users-provider'

interface DataTableBulkActionsProps {
  table: Table<User>
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const { setOpen } = useUsers()
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length

  if (selectedCount === 0) {
    return null
  }

  const handleBatchDelete = () => {
    // For now, we'll just show single delete dialog for each
    // In a real implementation, you might want a batch delete API
    setOpen('batch-delete')
  }

  return (
    <div className='animate-in slide-in-from-bottom-2 fixed inset-x-0 bottom-4 z-50 mx-auto w-fit'>
      <div className='bg-background flex items-center gap-2 rounded-lg border p-2 shadow-lg'>
        <div className='text-muted-foreground flex items-center gap-2 px-2 text-sm'>
          <span className='text-foreground font-medium'>{selectedCount}</span>
          selected
        </div>
        <div className='bg-border h-4 w-px' />
        <Button
          variant='ghost'
          size='sm'
          onClick={handleBatchDelete}
          className='gap-2'
        >
          <Trash2 className='h-4 w-4' />
          Delete
        </Button>
        <div className='bg-border h-4 w-px' />
        <Button
          variant='ghost'
          size='sm'
          onClick={() => table.toggleAllPageRowsSelected(false)}
          className='gap-2'
        >
          <X className='h-4 w-4' />
          Clear
        </Button>
      </div>
    </div>
  )
}
