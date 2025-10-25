import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type PrefillGroupManagementProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PrefillGroupManagement({
  open,
  onOpenChange,
}: PrefillGroupManagementProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prefill Group Management</DialogTitle>
          <DialogDescription>
            Manage prefill groups for models, tags, and endpoints
          </DialogDescription>
        </DialogHeader>

        <div className='text-muted-foreground py-12 text-center'>
          <p>Prefill group management coming soon...</p>
        </div>

        <div className='flex justify-end'>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
