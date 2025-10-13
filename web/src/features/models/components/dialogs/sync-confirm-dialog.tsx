import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useModels } from '../models-provider'

type SyncConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SyncConfirmDialog({
  open,
  onOpenChange,
}: SyncConfirmDialogProps) {
  const { setOpen } = useModels()

  const handleSync = () => {
    onOpenChange(false)
    setOpen('sync-wizard')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Sync Official Models</DialogTitle>
          <DialogDescription>
            Synchronize models and vendors from the official metadata repository
            maintained by the community.
          </DialogDescription>
        </DialogHeader>
        <div className='text-muted-foreground text-sm'>
          <p>
            To contribute or report issues, visit:{' '}
            <a
              href='https://github.com/basellm/llm-metadata'
              target='_blank'
              rel='noreferrer'
              className='text-primary hover:underline'
            >
              github.com/basellm/llm-metadata
            </a>
          </p>
        </div>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            size='sm'
          >
            Cancel
          </Button>
          <Button onClick={handleSync} size='sm'>
            <RefreshCw className='mr-2 h-4 w-4' />
            Start Sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
