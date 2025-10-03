import { useState } from 'react'
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
import { deleteApiKey } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import { useApiKeys } from './api-keys-provider'

export function ApiKeysDeleteDialog() {
  const { open, setOpen, currentRow, triggerRefresh } = useApiKeys()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!currentRow) return

    setIsDeleting(true)
    try {
      const result = await deleteApiKey(currentRow.id)
      if (result.success) {
        toast.success(SUCCESS_MESSAGES.API_KEY_DELETED)
        setOpen(null)
        triggerRefresh()
      } else {
        toast.error(result.message || ERROR_MESSAGES.DELETE_FAILED)
      }
    } catch (error) {
      toast.error(ERROR_MESSAGES.UNEXPECTED)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog
      open={open === 'delete'}
      onOpenChange={(open) => !open && setOpen(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete API key{' '}
            <span className='font-semibold'>{currentRow?.name}</span>. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
