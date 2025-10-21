import { useQueryClient } from '@tanstack/react-query'
import { type Row } from '@tanstack/react-table'
import { Power, PowerOff, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  return (
    <div className='flex items-center gap-2'>
      <Button variant='ghost' size='sm' onClick={handleEnableAll}>
        <Power className='mr-1.5 h-3.5 w-3.5' />
        Enable All
      </Button>
      <Button variant='ghost' size='sm' onClick={handleDisableAll}>
        <PowerOff className='mr-1.5 h-3.5 w-3.5' />
        Disable All
      </Button>
      <Button variant='ghost' size='sm' onClick={handleBatchEdit}>
        <Pencil className='mr-1.5 h-3.5 w-3.5' />
        Batch Edit
      </Button>
    </div>
  )
}
