import { useState } from 'react'
import {
  Plus,
  FileQuestion,
  RefreshCw,
  Layers,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SyncConfirmDialog } from './dialogs/sync-confirm-dialog'
import { useModels } from './models-provider'

export function ModelsPrimaryButtons() {
  const { setOpen, setCurrentRow } = useModels()
  const [showSyncDialog, setShowSyncDialog] = useState(false)

  const handleCreateModel = () => {
    setCurrentRow(null)
    setOpen('create-model')
  }

  const handleMissingModels = () => {
    setOpen('missing-models')
  }

  const handlePrefillGroups = () => {
    setOpen('prefill-groups')
  }

  return (
    <>
      <div className='flex items-center gap-2'>
        <Button onClick={handleCreateModel} size='sm'>
          <Plus className='mr-2 h-4 w-4' />
          Add Model
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm'>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-56'>
            <DropdownMenuLabel>Model Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleMissingModels}>
              <FileQuestion className='mr-2 h-4 w-4' />
              <span>Missing Models</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handlePrefillGroups}>
              <Layers className='mr-2 h-4 w-4' />
              <span>Prefill Groups</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => setShowSyncDialog(true)}>
              <RefreshCw className='mr-2 h-4 w-4' />
              <span>Sync Official Data</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SyncConfirmDialog
        open={showSyncDialog}
        onOpenChange={setShowSyncDialog}
      />
    </>
  )
}
