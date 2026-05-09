import { Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ============================================================================
// Telegram Bind Dialog Component
// ============================================================================

interface TelegramBindDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  botName: string
  onSuccess: () => void
}

export function TelegramBindDialog({
  open,
  onOpenChange,
  botName,
}: TelegramBindDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Bind Telegram Account')}</DialogTitle>
          <DialogDescription>
            {t('Click the button below to bind your Telegram account')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <Alert>
            <Send className='h-4 w-4' />
            <AlertDescription>
              {t(
                'You will be redirected to Telegram to complete the binding process.'
              )}
            </AlertDescription>
          </Alert>

          <div className='flex flex-col items-center justify-center gap-4 rounded-lg border p-6'>
            <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900'>
              <Send className='h-6 w-6 text-blue-600 dark:text-blue-400' />
            </div>

            <div className='text-center'>
              <p className='text-muted-foreground text-sm'>
                {t('Bot:')}{' '}
                <span className='font-mono font-semibold'>@{botName}</span>
              </p>
              <p className='text-muted-foreground mt-1 text-xs'>
                {t(
                  "After clicking the button, you'll be asked to authorize the bot"
                )}
              </p>
            </div>

            {/* Telegram Login Widget will be injected here by react-telegram-login */}
            <div id='telegram-login-widget' className='flex justify-center'>
              {/* This would require the react-telegram-login library */}
              <div className='text-muted-foreground rounded-lg border border-dashed px-6 py-3 text-sm'>
                {t('Telegram Login Widget')}
              </div>
            </div>
          </div>

          <p className='text-muted-foreground text-center text-xs'>
            {t('The binding will complete automatically after authorization')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
