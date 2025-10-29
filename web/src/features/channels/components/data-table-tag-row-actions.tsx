import { useQueryClient } from '@tanstack/react-query'
import { type Row } from '@tanstack/react-table'
import { MoreHorizontal, Power, PowerOff, Pencil, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { handleEnableTagChannels, handleDisableTagChannels } from '../lib'
import type { Channel } from '../types'
import { useChannels } from './channels-provider'

interface DataTableTagRowActionsProps {
  row: Row<Channel & { tag?: string }>
}

export function DataTableTagRowActions({ row }: DataTableTagRowActionsProps) {
  const tag = row.original.tag
  const { setOpen, setCurrentTag } = useChannels()
  const queryClient = useQueryClient()

  if (!tag) return null

  const handleEnableAll = () => {
    handleEnableTagChannels(tag, queryClient)
  }

  const handleDisableAll = () => {
    handleDisableTagChannels(tag, queryClient)
  }

  const handleBatchEdit = () => {
    setCurrentTag(tag)
    setOpen('tag-batch-edit')
  }

  const handleEditTag = () => {
    setCurrentTag(tag)
    setOpen('edit-tag')
  }

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
      <DropdownMenuContent align='end' className='w-48'>
        {/* Edit Tag */}
        <DropdownMenuItem onClick={handleEditTag}>
          Edit Tag
          <DropdownMenuShortcut>
            <Edit size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Batch Edit */}
        <DropdownMenuItem onClick={handleBatchEdit}>
          Batch Edit
          <DropdownMenuShortcut>
            <Pencil size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Enable All */}
        <DropdownMenuItem onClick={handleEnableAll}>
          Enable All
          <DropdownMenuShortcut>
            <Power size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Disable All */}
        <DropdownMenuItem onClick={handleDisableAll}>
          Disable All
          <DropdownMenuShortcut>
            <PowerOff size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
