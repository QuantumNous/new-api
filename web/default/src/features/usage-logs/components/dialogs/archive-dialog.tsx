/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { getLogArchive } from '../../api'
import type { UsageLog } from '../../data/schema'
import type { LogArchiveDetail, LogArchivePart } from '../../types'

interface ArchiveDialogProps {
  log: UsageLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ArchivePayloadPanelProps {
  title: string
  value: unknown
  isLoading?: boolean
}

const defaultArchivePart: LogArchivePart = 'response_body'

function emptyLoadedParts(): Record<LogArchivePart, boolean> {
  return {
    request_headers: false,
    request_body: false,
    response_body: false,
  }
}

function formatPayload(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function ArchiveMetaRow(props: { label: string; value: string }) {
  if (!props.value) return null
  return (
    <div className='min-w-0 space-y-1'>
      <span className='text-muted-foreground block text-[11px]'>
        {props.label}
      </span>
      <span className='block min-w-0 truncate font-mono text-xs'>
        {props.value}
      </span>
    </div>
  )
}

function ArchivePayloadPanel({ title, value, isLoading }: ArchivePayloadPanelProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const text = formatPayload(value)

  return (
    <div className='min-w-0 space-y-2'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-muted-foreground text-xs font-medium'>
          {title}
        </span>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-7 px-2'
          disabled={!text || isLoading}
          onClick={() => copyToClipboard(text)}
          title={t('Copy to clipboard')}
          aria-label={t('Copy to clipboard')}
        >
          {copiedText === text ? (
            <Check className='size-3.5 text-green-600' />
          ) : (
            <Copy className='size-3.5' />
          )}
        </Button>
      </div>
      <ScrollArea className='bg-muted/30 h-[48vh] min-h-[18rem] overflow-hidden rounded-md border'>
        {isLoading ? (
          <div className='flex h-full min-h-[18rem] items-center justify-center'>
            <Loader2 className='text-muted-foreground size-5 animate-spin' />
          </div>
        ) : (
          <pre
            className={cn(
              'min-w-0 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap',
              !text && 'text-muted-foreground'
            )}
          >
            {text || t('No archive data available')}
          </pre>
        )}
      </ScrollArea>
    </div>
  )
}

export function ArchiveDialog({ log, open, onOpenChange }: ArchiveDialogProps) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<LogArchiveDetail | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activePart, setActivePart] =
    useState<LogArchivePart>(defaultArchivePart)
  const [loadedParts, setLoadedParts] =
    useState<Record<LogArchivePart, boolean>>(emptyLoadedParts)

  useEffect(() => {
    setDetail(null)
    setError('')
    setIsLoading(false)
    setActivePart(defaultArchivePart)
    setLoadedParts(emptyLoadedParts())
  }, [log?.id, open])

  useEffect(() => {
    if (!open || !log?.id || loadedParts[activePart]) {
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError('')

    getLogArchive(log.id, activePart)
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data) {
          setDetail((previous) => ({
            ...(previous ?? {}),
            ...result.data,
          }) as LogArchiveDetail)
          setLoadedParts((previous) => ({
            ...previous,
            [activePart]: true,
          }))
        } else {
          setError(result.message || t('Failed to load archive details'))
        }
      })
      .catch((err) => {
        if (cancelled) return
        // eslint-disable-next-line no-console
        console.error('Failed to load log archive:', err)
        setError(t('Failed to load archive details'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activePart, loadedParts, log?.id, open, t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='min-w-0 overflow-hidden sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>{t('Archived Request')}</DialogTitle>
          <DialogDescription>
            {t('View archived request and response data for this log.')}
          </DialogDescription>
        </DialogHeader>

        {isLoading && !detail ? (
          <div className='flex items-center justify-center py-16'>
            <Loader2 className='text-muted-foreground size-6 animate-spin' />
          </div>
        ) : !detail && error ? (
          <Alert variant='destructive'>
            <AlertTriangle className='size-4' />
            <AlertTitle>{t('Failed to load archive details')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : detail ? (
          <div className='min-w-0 space-y-3'>
            <div className='grid min-w-0 grid-cols-1 gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4'>
              <ArchiveMetaRow label={t('Session')} value={detail.session_id || ''} />
              <ArchiveMetaRow
                label={t('Request ID')}
                value={detail.request_id || log?.request_id || ''}
              />
              <ArchiveMetaRow
                label={t('Request Time')}
                value={detail.request_time || formatTimestampToDate(log?.created_at || 0)}
              />
              <ArchiveMetaRow
                label={t('Response Time')}
                value={detail.response_time}
              />
            </div>

            {error ? (
              <Alert variant='destructive'>
                <AlertTriangle className='size-4' />
                <AlertTitle>{t('Failed to load archive details')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Tabs
              value={activePart}
              onValueChange={(value) => setActivePart(value as LogArchivePart)}
              className='min-w-0'
            >
              <TabsList className='w-full sm:w-fit'>
                <TabsTrigger value='request_headers'>
                  {t('Request Headers')}
                </TabsTrigger>
                <TabsTrigger value='request_body'>
                  {t('Request Body')}
                </TabsTrigger>
                <TabsTrigger value='response_body'>
                  {t('Response Body')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value='request_headers' className='min-w-0'>
                <ArchivePayloadPanel
                  title={t('Request Headers')}
                  value={detail.request_headers}
                  isLoading={isLoading && activePart === 'request_headers'}
                />
              </TabsContent>
              <TabsContent value='request_body' className='min-w-0'>
                <ArchivePayloadPanel
                  title={t('Request Body')}
                  value={detail.request_body}
                  isLoading={isLoading && activePart === 'request_body'}
                />
              </TabsContent>
              <TabsContent value='response_body' className='min-w-0'>
                <ArchivePayloadPanel
                  title={t('Response Body')}
                  value={detail.response_body}
                  isLoading={isLoading && activePart === 'response_body'}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className='text-muted-foreground py-12 text-center text-sm'>
            {t('No archive data available')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
