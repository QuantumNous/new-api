import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Trash2, Edit, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { updateApiKeyStatus } from '../api'
import { apiKeySchema } from '../data/schema'
import { useApiKeys } from './api-keys-provider'

type DataTableRowActionsProps<TData> = {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const apiKey = apiKeySchema.parse(row.original)
  const { setOpen, setCurrentRow, triggerRefresh } = useApiKeys()
  const isEnabled = apiKey.status === 1

  const handleToggleStatus = async () => {
    const newStatus = isEnabled ? 2 : 1
    const action = isEnabled ? 'disable' : 'enable'

    try {
      const result = await updateApiKeyStatus(apiKey.id, newStatus)
      if (result.success) {
        toast.success(`API Key ${action}d successfully`)
        triggerRefresh()
      } else {
        toast.error(result.message || `Failed to ${action} API Key`)
      }
    } catch (error) {
      toast.error(`Failed to ${action} API Key`)
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='data-[state=open]:bg-muted flex h-8 w-8 p-0'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[160px]'>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(apiKey)
            setOpen('update')
          }}
        >
          <Edit className='mr-2 size-4' />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleToggleStatus}>
          {isEnabled ? (
            <>
              <PowerOff className='mr-2 size-4' />
              Disable
            </>
          ) : (
            <>
              <Power className='mr-2 size-4' />
              Enable
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(apiKey)
            setOpen('delete')
          }}
          className='text-destructive focus:text-destructive'
        >
          Delete
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
