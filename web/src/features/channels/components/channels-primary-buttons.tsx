import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, MoreHorizontal, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { handleDeleteAllDisabled, handleFixAbilities } from '../lib'
import { useChannels } from './channels-provider'

export function ChannelsPrimaryButtons() {
  const { setOpen } = useChannels()
  const queryClient = useQueryClient()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  return (
    <>
      <div className='flex items-center gap-2'>
        {/* Create Channel */}
        <Button onClick={() => setOpen('create-channel')} size='sm'>
          <Plus className='h-4 w-4' />
          Create Channel
        </Button>

        {/* More Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm'>
              <MoreHorizontal className='h-4 w-4' />
              More Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-56'>
            <DropdownMenuItem
              onClick={() => {
                handleFixAbilities(queryClient, (result) => {
                  console.log('Fix abilities result:', result)
                })
              }}
            >
              <Settings2 className='mr-2 h-4 w-4' />
              Fix Abilities
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setShowDeleteDialog(true)
              }}
              className='text-destructive focus:text-destructive'
            >
              <Trash2 className='mr-2 h-4 w-4' />
              Delete All Disabled
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title='Delete All Disabled Channels?'
        desc='This will permanently delete all manually and automatically disabled channels. This action cannot be undone.'
        destructive
        handleConfirm={() => {
          handleDeleteAllDisabled(queryClient, (count) => {
            console.log(`Deleted ${count} channels`)
          })
          setShowDeleteDialog(false)
        }}
      />
    </>
  )
}
