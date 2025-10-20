import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useChannels } from '../channels-provider'

type MultiKeyManageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MultiKeyManageDialog({
  open,
  onOpenChange,
}: MultiKeyManageDialogProps) {
  const { currentRow } = useChannels()

  if (!currentRow) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Multi-Keys</DialogTitle>
        </DialogHeader>
        <p className='text-muted-foreground text-sm'>
          Multi-key management for {currentRow.name} - Feature coming soon
        </p>
      </DialogContent>
    </Dialog>
  )
}
