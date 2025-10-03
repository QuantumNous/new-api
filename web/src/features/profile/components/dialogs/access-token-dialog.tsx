import { useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/copy-button'
import { useAccessToken } from '../../hooks'

// ============================================================================
// Access Token Dialog Component
// ============================================================================

interface AccessTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccessTokenDialog({
  open,
  onOpenChange,
}: AccessTokenDialogProps) {
  const { token, generating, generate } = useAccessToken()

  // Auto-generate token when dialog opens if no token exists
  useEffect(() => {
    if (open && !token) {
      generate()
    }
  }, [open, token, generate])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Access Token</DialogTitle>
          <DialogDescription>
            Your system access token for API authentication. Keep it secure and
            don't share it with others.
          </DialogDescription>
        </DialogHeader>

        <div className='my-6 space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='token'>Token</Label>
            <div className='flex gap-2'>
              <Input
                id='token'
                type='text'
                value={token}
                readOnly
                className='font-mono text-xs'
                placeholder='Click "Generate" to create a token'
              />
              <CopyButton
                value={token}
                variant='outline'
                className='size-9'
                iconClassName='size-4'
                tooltip='Copy token'
                aria-label='Copy token'
              />
            </div>
            <p className='text-muted-foreground text-xs'>
              Use this token for API authentication
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type='button'
            onClick={generate}
            disabled={generating}
            className='gap-2'
          >
            <RefreshCw
              className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`}
            />
            {generating ? 'Generating...' : 'Regenerate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
