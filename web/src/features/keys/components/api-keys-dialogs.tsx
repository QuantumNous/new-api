import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { deleteApiKey } from '../api'
import { ApiKeysMutateDrawer } from './api-keys-mutate-drawer'
import { useApiKeys } from './api-keys-provider'

export function ApiKeysDialogs() {
  const { open, setOpen, currentRow, setCurrentRow, triggerRefresh } =
    useApiKeys()

  const handleDelete = async () => {
    if (!currentRow) return

    try {
      const result = await deleteApiKey(currentRow.id)
      if (result.success) {
        toast.success('API Key deleted successfully')
        setOpen(null)
        setTimeout(() => {
          setCurrentRow(null)
        }, 500)
        triggerRefresh()
      } else {
        toast.error(result.message || 'Failed to delete API Key')
      }
    } catch (error) {
      toast.error('An error occurred while deleting the API Key')
    }
  }

  return (
    <>
      <ApiKeysMutateDrawer
        key='api-key-create'
        open={open === 'create'}
        onOpenChange={() => setOpen('create')}
      />

      {currentRow && (
        <>
          <ApiKeysMutateDrawer
            key={`api-key-update-${currentRow.id}`}
            open={open === 'update'}
            onOpenChange={() => {
              setOpen('update')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <ConfirmDialog
            key='api-key-delete'
            destructive
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            handleConfirm={handleDelete}
            className='max-w-md'
            title={`Delete API Key: ${currentRow.name}?`}
            desc={
              <>
                You are about to delete the API key{' '}
                <strong>{currentRow.name}</strong>
                . <br />
                This action cannot be undone.
              </>
            }
            confirmText='Delete'
          />
        </>
      )}
    </>
  )
}
