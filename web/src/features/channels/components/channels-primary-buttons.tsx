import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, MoreHorizontal, Settings2, Trash2, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { handleDeleteAllDisabled, handleFixAbilities } from '../lib'
import { useChannels } from './channels-provider'

export function ChannelsPrimaryButtons() {
  const { setOpen, enableTagMode, setEnableTagMode } = useChannels()
  const queryClient = useQueryClient()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleTagModeToggle = (checked: boolean) => {
    localStorage.setItem('enable-tag-mode', String(checked))
    setEnableTagMode(checked)
  }

  return (
    <>
      <div className='flex items-center gap-2'>
        {/* Tag Mode Toggle */}
        <div className='flex items-center gap-2 rounded-md border px-3 py-1.5'>
          <Tags className='text-muted-foreground h-4 w-4' />
          <Label htmlFor='tag-mode' className='cursor-pointer text-sm'>
            Tag Mode
          </Label>
          <Switch
            id='tag-mode'
            checked={enableTagMode}
            onCheckedChange={handleTagModeToggle}
          />
        </div>

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
