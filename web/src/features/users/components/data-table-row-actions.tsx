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
import { manageUser, type ManageUserAction } from '../api'
import { type User } from '../data/schema'
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
        let message = ''
        switch (action) {
          case 'enable':
            message = 'User enabled successfully'
            break
          case 'disable':
            message = 'User disabled successfully'
            break
          case 'promote':
            message = 'User promoted to admin successfully'
            break
          case 'demote':
            message = 'User demoted to regular user successfully'
            break
        }
        toast.success(message)
        triggerRefresh()
      } else {
        toast.error(result.message || `Failed to ${action} user`)
      }
    } catch (error) {
      toast.error('An error occurred')
    }
  }

  // Check if user is disabled
  const isDisabled = user.status === 2
  // Check user role: 1 = user, 10 = admin, 100 = root
  const isAdmin = user.role >= 10
  const isRoot = user.role === 100

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
