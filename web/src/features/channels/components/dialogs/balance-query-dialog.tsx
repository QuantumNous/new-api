import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useChannels } from '../channels-provider'

type BalanceQueryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BalanceQueryDialog({
  open,
  onOpenChange,
}: BalanceQueryDialogProps) {
  const { currentRow } = useChannels()

  if (!currentRow) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Query Balance</DialogTitle>
        </DialogHeader>
        <p className='text-muted-foreground text-sm'>
          Balance query for {currentRow.name} - Feature coming soon
        </p>
      </DialogContent>
    </Dialog>
  )
}
