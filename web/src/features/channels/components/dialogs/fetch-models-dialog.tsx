import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useChannels } from '../channels-provider'

type FetchModelsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FetchModelsDialog({
  open,
  onOpenChange,
}: FetchModelsDialogProps) {
  const { currentRow } = useChannels()

  if (!currentRow) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fetch Models</DialogTitle>
        </DialogHeader>
        <p className='text-muted-foreground text-sm'>
          Fetch models for {currentRow.name} - Feature coming soon
        </p>
      </DialogContent>
    </Dialog>
  )
}
