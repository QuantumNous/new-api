import { type Row } from '@tanstack/react-table'
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { manageUser } from '../api'
import { USER_STATUS, USER_ROLE, ERROR_MESSAGES } from '../constants'
import { getUserActionMessage } from '../lib'
import { type User, type ManageUserAction } from '../types'
import { useUsers } from './users-provider'

interface DataTableRowActionsProps {
  row: Row<User>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const user = row.original
  const { setOpen, setCurrentRow, triggerRefresh } = useUsers()

  const handleEdit = () => {
    setCurrentRow(user)
    setOpen('update')
  }

  const handleDelete = () => {
    setCurrentRow(user)
    setOpen('delete')
  }

  const handleManage = async (action: Exclude<ManageUserAction, 'delete'>) => {
    try {
      const result = await manageUser(user.id, action)
      if (result.success) {
        toast.success(getUserActionMessage(action))
        triggerRefresh()
      } else {
        toast.error(result.message || `Failed to ${action} user`)
      }
    } catch (error) {
      toast.error(ERROR_MESSAGES.UNEXPECTED)
    }
  }

  const isDisabled = user.status === USER_STATUS.DISABLED
  const isAdmin = user.role >= USER_ROLE.ADMIN
  const isRoot = user.role === USER_ROLE.ROOT

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='data-[state=open]:bg-muted flex h-8 w-8 p-0'
        >
          <MoreHorizontal className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[160px]'>
        <DropdownMenuItem onClick={handleEdit}>
          <Pencil className='mr-2 h-4 w-4' />
          Edit
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {isDisabled ? (
          <DropdownMenuItem onClick={() => handleManage('enable')}>
            <Power className='mr-2 h-4 w-4' />
            Enable
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => handleManage('disable')}
            disabled={isRoot}
          >
            <PowerOff className='mr-2 h-4 w-4' />
            Disable
          </DropdownMenuItem>
        )}

        {isAdmin && !isRoot && (
          <DropdownMenuItem onClick={() => handleManage('demote')}>
            <ArrowDown className='mr-2 h-4 w-4' />
            Demote
          </DropdownMenuItem>
        )}

        {!isAdmin && (
          <DropdownMenuItem onClick={() => handleManage('promote')}>
            <ArrowUp className='mr-2 h-4 w-4' />
            Promote
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleDelete}
          className='text-destructive'
          disabled={isRoot}
        >
          <Trash2 className='mr-2 h-4 w-4' />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
