import { Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

interface FailReasonDialogProps {
  failReason: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FailReasonDialog({
  failReason,
  open,
  onOpenChange,
}: FailReasonDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Fail Reason Details')}</DialogTitle>
          <DialogDescription>
            {t('View the complete error message and details')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[500px] pr-4'>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label className='text-sm font-semibold'>
                {t('Error Message')}
              </Label>
              <div className='bg-muted/50 relative rounded-md border border-red-200 p-3'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='absolute top-2 right-2 h-8 w-8 p-0'
                  onClick={() => copyToClipboard(failReason)}
                  title={t('Copy to clipboard')}
                >
                  {copiedText === failReason ? (
                    <Check className='size-4 text-green-600' />
                  ) : (
                    <Copy className='size-4' />
                  )}
                </Button>
                <p className='overflow-wrap-anywhere pr-10 text-sm leading-relaxed break-all whitespace-pre-wrap text-red-600'>
                  {failReason || '-'}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
