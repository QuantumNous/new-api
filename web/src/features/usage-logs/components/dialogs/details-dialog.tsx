import { Copy, Check, Route, Settings2 } from 'lucide-react'
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
import { StatusBadge } from '@/components/status-badge'
import type { UsageLog } from '../../data/schema'
import { parseLogOther } from '../../lib/format'

function getActionLabel(action: string, t: (key: string) => string): string {
  switch ((action || '').toLowerCase()) {
    case 'set':
      return t('Set')
    case 'delete':
      return t('Delete')
    case 'copy':
      return t('Copy')
    case 'move':
      return t('Move')
    case 'append':
      return t('Append')
    case 'prepend':
      return t('Prepend')
    case 'trim_prefix':
      return t('Trim Prefix')
    case 'trim_suffix':
      return t('Trim Suffix')
    case 'ensure_prefix':
      return t('Ensure Prefix')
    case 'ensure_suffix':
      return t('Ensure Suffix')
    case 'trim_space':
      return t('Trim Space')
    case 'to_lower':
      return t('To Lower')
    case 'to_upper':
      return t('To Upper')
    case 'replace':
      return t('Replace')
    case 'regex_replace':
      return t('Regex Replace')
    case 'set_header':
      return t('Set Header')
    case 'delete_header':
      return t('Delete Header')
    case 'copy_header':
      return t('Copy Header')
    case 'move_header':
      return t('Move Header')
    case 'pass_headers':
      return t('Pass Headers')
    case 'sync_fields':
      return t('Sync Fields')
    case 'return_error':
      return t('Return Error')
    default:
      return action
  }
}

function parseAuditLine(line: string) {
  if (typeof line !== 'string') return null
  const firstSpace = line.indexOf(' ')
  if (firstSpace <= 0) return { action: line, content: line }
  return {
    action: line.slice(0, firstSpace),
    content: line.slice(firstSpace + 1),
  }
}

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
  const showConversion =
    isAdmin && (other?.request_path || conversionChain.length > 0)

  const getLogTypeLabel = (type: number): string => {
    switch (type) {
      case 1:
        return t('Top-up')
      case 2:
        return t('Consume')
      case 3:
        return t('Manage')
      case 4:
        return t('System')
      case 5:
        return t('Error')
      default:
        return t('Unknown')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Log Details')}</DialogTitle>
          <DialogDescription>
            {t('View the complete details for this')}{' '}
            {getLogTypeLabel(log.type)} {t('log')}
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
                      <Route
                        className='text-muted-foreground size-4'
                        aria-hidden='true'
                      />
                      <span className='break-words'>{conversionLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isAdmin &&
              other?.po &&
              Array.isArray(other.po) &&
              other.po.length > 0 && (
                <div className='space-y-2'>
                  <Label className='flex items-center gap-1.5 text-sm font-semibold'>
                    <Settings2 className='size-4' aria-hidden='true' />
                    {t('Param Override')}
                    <StatusBadge
                      label={String(other.po.length)}
                      variant='neutral'
                      copyable={false}
                    />
                  </Label>
                  <div className='space-y-1.5'>
                    {other.po.filter(Boolean).map((line, idx) => {
                      const parsed = parseAuditLine(line)
                      if (!parsed) return null
                      return (
                        <div
                          key={idx}
                          className='bg-muted/50 flex items-start gap-2.5 rounded-md border p-2.5'
                        >
                          <StatusBadge
                            variant='neutral'
                            label={getActionLabel(parsed.action, t)}
                            className='shrink-0 font-medium'
                            copyable={false}
                          />
                          <span className='min-w-0 font-mono text-xs leading-relaxed break-words'>
                            {parsed.content}
                          </span>
                        </div>
                      )
                    })}
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
