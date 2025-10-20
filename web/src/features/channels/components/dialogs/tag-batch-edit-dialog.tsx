import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type TagBatchEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TagBatchEditDialog({
  open,
  onOpenChange,
}: TagBatchEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batch Edit by Tag</DialogTitle>
        </DialogHeader>
        <p className='text-muted-foreground text-sm'>
          Tag batch edit - Feature coming soon
        </p>
      </DialogContent>
    </Dialog>
  )
}
