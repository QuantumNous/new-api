import { QrCode } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ============================================================================
// WeChat Bind Dialog Component
// ============================================================================

interface WeChatBindDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function WeChatBindDialog({
  open,
  onOpenChange,
}: WeChatBindDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Bind WeChat Account</DialogTitle>
          <DialogDescription>
            Scan the QR code with WeChat to bind your account
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <Alert>
            <QrCode className='h-4 w-4' />
            <AlertDescription>
              Please use WeChat's "Scan QR Code" feature to complete the binding
              process.
            </AlertDescription>
          </Alert>

          <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-8'>
            <QrCode className='text-muted-foreground mb-3 h-16 w-16' />
            <p className='text-muted-foreground text-sm'>
              WeChat QR code will be displayed here
            </p>
            <p className='text-muted-foreground mt-2 text-xs'>
              This feature requires server-side WeChat configuration
            </p>
          </div>

          <p className='text-muted-foreground text-center text-xs'>
            After scanning, the binding will complete automatically
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
