import { Copy, Check, Route } from 'lucide-react'
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
import type { UsageLog } from '../../data/schema'
import { parseLogOther } from '../../lib/format'

interface DetailsDialogProps {
  log: UsageLog
  isAdmin: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DetailsDialog({
  log,
  isAdmin,
  open,
  onOpenChange,
}: DetailsDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const details = log.content ?? ''
  const other = parseLogOther(log.other)
  const conversionChain =
    other && Array.isArray(other.request_conversion)
      ? other.request_conversion.filter(Boolean)
      : []
  const conversionLabel =
    conversionChain.length <= 1
      ? t('Native format')
      : conversionChain.join(' -> ')
  const showConversion = isAdmin && (other?.request_path || conversionChain.length > 0)

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
          <DialogTitle>{t('Log Details')}</DialogTitle>
          <DialogDescription>
            {t('View the complete details for this')}{' '}
            {getLogTypeLabel(log.type)}{' '}
            {t('log')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[500px] pr-4'>
          <div className='space-y-4 py-4'>
            {showConversion && (
              <div className='space-y-2'>
                <Label className='text-sm font-semibold'>
                  {t('Request conversion')}
                </Label>
                <div className='bg-muted/50 relative rounded-md border p-3'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='absolute top-2 right-2 h-8 w-8 p-0'
                    onClick={() => copyToClipboard(conversionLabel)}
                    title={t('Copy to clipboard')}
                    aria-label={t('Copy to clipboard')}
                  >
                    {copiedText === conversionLabel ? (
                      <Check className='size-4 text-green-600' />
                    ) : (
                      <Copy className='size-4' />
                    )}
                  </Button>
                  <div className='space-y-2 pr-10'>
                    {other?.request_path ? (
                      <div className='text-sm'>
                        <span className='text-muted-foreground'>
                          {t('Path:')}{' '}
                        </span>
                        <span className='font-mono break-words'>
                          {other.request_path}
                        </span>
                      </div>
                    ) : null}
                    <div className='flex items-center gap-2 text-sm'>
                      <Route className='text-muted-foreground size-4' aria-hidden='true' />
                      <span className='break-words'>{conversionLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className='space-y-2'>
              <Label className='text-sm font-semibold'>{t('Content')}</Label>
              <div className='bg-muted/50 relative rounded-md border p-3'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='absolute top-2 right-2 h-8 w-8 p-0'
                  onClick={() => copyToClipboard(details)}
                  title={t('Copy to clipboard')}
                  aria-label={t('Copy to clipboard')}
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
