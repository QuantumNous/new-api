import { Copy, Check } from 'lucide-react'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

interface DetailsDialogProps {
  details: string
  logType: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DetailsDialog({
  details,
  logType,
  open,
  onOpenChange,
}: DetailsDialogProps) {
  const { copiedText, copyToClipboard } = useCopyToClipboard()

  // Get log type label
  const getLogTypeLabel = (type: number): string => {
    switch (type) {
      case 1:
        return 'Top-up'
      case 2:
        return 'Consume'
      case 3:
        return 'Manage'
      case 4:
        return 'System'
      case 5:
        return 'Error'
      default:
        return 'Unknown'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Log Details</DialogTitle>
          <DialogDescription>
            View the complete details for this {getLogTypeLabel(logType)} log
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[500px] pr-4'>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label className='text-sm font-semibold'>Content</Label>
              <div className='bg-muted/50 relative rounded-md border p-3'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='absolute top-2 right-2 h-8 w-8 p-0'
                  onClick={() => copyToClipboard(details)}
                  title='Copy to clipboard'
                >
                  {copiedText === details ? (
                    <Check className='size-4 text-green-600' />
                  ) : (
                    <Copy className='size-4' />
                  )}
                </Button>
                <p className='pr-10 text-sm leading-relaxed break-words whitespace-pre-wrap'>
                  {details || '-'}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
