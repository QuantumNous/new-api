import { useEffect } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
          <DialogTitle>{t('Access Token')}</DialogTitle>
          <DialogDescription>
            {t(
              "Your system access token for API authentication. Keep it secure and don't share it with others."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='my-6 space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='token'>{t('Token')}</Label>
            <div className='flex gap-2'>
              <Input
                id='token'
                type='text'
                value={token}
                readOnly
                className='font-mono text-xs'
                placeholder={t('Click "Generate" to create a token')}
              />
              <CopyButton
                value={token}
                variant='outline'
                className='size-9'
                iconClassName='size-4'
                tooltip={t('Copy token')}
                aria-label={t('Copy token')}
              />
            </div>
            <p className='text-muted-foreground text-xs'>
              {t('Use this token for API authentication')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('Close')}
          </Button>
          <Button
            type='button'
            onClick={generate}
            disabled={generating}
            className='gap-2'
          >
            {generating ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <RefreshCw className='h-4 w-4' />
            )}
            {generating ? t('Generating...') : t('Regenerate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
