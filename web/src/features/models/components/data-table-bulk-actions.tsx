import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { batchDeleteModels } from '../api'
import { ERROR_MESSAGES } from '../constants'
import { type Model } from '../types'
import { useModels } from './models-provider'

interface DataTableBulkActionsProps {
  table: Table<Model>
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const { triggerRefresh } = useModels()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length

  const handleBatchDelete = async () => {
    setIsDeleting(true)

    const ids = selectedRows.map((row) => row.original.id)
    const result = await batchDeleteModels(ids)

    if (result.success) {
      toast.success(result.message)
      table.resetRowSelection()
      triggerRefresh()
      setShowDeleteDialog(false)
    } else {
      toast.error(result.message || ERROR_MESSAGES.BATCH_DELETE_FAILED)
    }

    setIsDeleting(false)
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='model'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteDialog(true)}
              className='size-8'
              aria-label='Delete selected models'
              title='Delete selected models'
            >
              <Trash2 />
              <span className='sr-only'>Delete selected models</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete selected models</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{' '}
              <strong>{selectedCount}</strong>{' '}
              {selectedCount === 1 ? 'model' : 'models'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleBatchDelete()
              }}
              disabled={isDeleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isDeleting ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
