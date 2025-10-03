import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { batchDeleteApiKeys } from '../api'
import { ERROR_MESSAGES } from '../constants'
import { type ApiKey } from '../types'
import { useApiKeys } from './api-keys-provider'

type ApiKeysMultiDeleteDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

export function ApiKeysMultiDeleteDialog<TData>({
  open,
  onOpenChange,
  table,
}: ApiKeysMultiDeleteDialogProps<TData>) {
  const { triggerRefresh } = useApiKeys()
  const [isDeleting, setIsDeleting] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      const ids = selectedRows.map((row) => (row.original as ApiKey).id)
      const result = await batchDeleteApiKeys(ids)

      if (result.success) {
        const count = result.data || ids.length
        toast.success(
          `Successfully deleted ${count} API key${count > 1 ? 's' : ''}`
        )
        table.resetRowSelection()
        triggerRefresh()
        onOpenChange(false)
      } else {
        toast.error(result.message || ERROR_MESSAGES.BATCH_DELETE_FAILED)
      }
    } catch (error) {
      toast.error(ERROR_MESSAGES.UNEXPECTED)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <ConfirmDialog
      destructive
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleConfirm}
      isLoading={isDeleting}
      className='max-w-md'
      title={`Delete ${selectedRows.length} API key${selectedRows.length > 1 ? 's' : ''}?`}
      desc={
        <>
          You are about to delete <strong>{selectedRows.length}</strong> API key
          {selectedRows.length > 1 ? 's' : ''}. <br />
          This action cannot be undone.
        </>
      }
      confirmText='Delete'
    />
  )
}
