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

interface PromptDialogProps {
  prompt: string
  promptEn?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PromptDialog({
  prompt,
  promptEn,
  open,
  onOpenChange,
}: PromptDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Prompt Details')}</DialogTitle>
          <DialogDescription>
            {t('View the complete prompt and its English translation')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[500px] pr-4'>
          <div className='space-y-4 py-4'>
            {/* Original Prompt */}
            <div className='space-y-2'>
              <Label className='text-sm font-semibold'>{t('Prompt')}</Label>
              <div className='bg-muted/50 relative rounded-md border p-3'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='absolute top-2 right-2 h-8 w-8 p-0'
                  onClick={() => copyToClipboard(prompt)}
                  title={t('Copy to clipboard')}
                >
                  {copiedText === prompt ? (
                    <Check className='size-4 text-green-600' />
                  ) : (
                    <Copy className='size-4' />
                  )}
                </Button>
                <p className='pr-10 text-sm leading-relaxed break-words whitespace-pre-wrap'>
                  {prompt || '-'}
                </p>
              </div>
            </div>

            {/* English Prompt */}
            {promptEn && (
              <div className='space-y-2'>
                <Label className='text-sm font-semibold'>
                  {t('Prompt (EN)')}
                </Label>
                <div className='bg-muted/50 relative rounded-md border p-3'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='absolute top-2 right-2 h-8 w-8 p-0'
                    onClick={() => copyToClipboard(promptEn)}
                    title={t('Copy to clipboard')}
                  >
                    {copiedText === promptEn ? (
                      <Check className='size-4 text-green-600' />
                    ) : (
                      <Copy className='size-4' />
                    )}
                  </Button>
                  <p className='pr-10 text-sm leading-relaxed break-words whitespace-pre-wrap'>
                    {promptEn}
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
