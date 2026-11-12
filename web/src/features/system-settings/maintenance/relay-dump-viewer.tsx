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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatTimestampToDate } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

type RelayDumpEntry = {
  id: string
  request_id: string
  created_at: number
  duration_ms: number
  channel_id: number
  channel_name: string
  model: string
  is_stream: boolean
  status_code: number
  error?: string
  size: number
}

type RelayDumpHeaders = Record<string, string[]>

type RelayDumpDetail = {
  request_id: string
  created_at: number
  duration_ms: number
  channel_id: number
  channel_name: string
  model: string
  is_stream: boolean
  request_path: string
  request?: {
    method?: string
    url?: string
    headers?: RelayDumpHeaders
    body?: string
    body_truncated?: boolean
    body_base64?: boolean
    body_missing?: boolean
  }
  response?: {
    status_code?: number
    headers?: RelayDumpHeaders
    body?: string
    body_truncated?: boolean
    body_base64?: boolean
    body_missing?: boolean
  }
  error?: string
}

type RelayDumpListResponse = {
  items: RelayDumpEntry[]
  total: number
  page: number
  page_size: number
}

function formatBytes(bytes: number): string {
  if (!bytes || Number.isNaN(bytes)) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  )
  const value = bytes / Math.pow(k, i)
  return `${Number.parseFloat(value.toFixed(value >= 100 ? 0 : 1))} ${sizes[i]}`
}

function statusClassName(statusCode: number): string {
  if (statusCode === 0) return 'text-muted-foreground'
  if (statusCode < 400) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-destructive'
}

function HeadersList(props: { headers?: RelayDumpHeaders }) {
  const { t } = useTranslation()
  const entries = Object.entries(props.headers ?? {})
  if (entries.length === 0) {
    return <p className='text-muted-foreground text-xs'>{t('No headers')}</p>
  }
  return (
    <dl className='flex flex-col gap-1'>
      {entries.map(([name, values]) => (
        <div key={name} className='grid gap-0.5 sm:grid-cols-[minmax(0,11rem)_1fr]'>
          <dt className='text-muted-foreground truncate font-mono text-xs'>
            {name}
          </dt>
          <dd className='min-w-0 break-all font-mono text-xs'>
            {values.join(', ')}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function BodyBlock(props: {
  body?: string
  truncated?: boolean
  base64?: boolean
  missing?: boolean
}) {
  const { t } = useTranslation()
  if (props.missing) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('Body not captured (streaming request body)')}
      </p>
    )
  }
  if (!props.body) {
    return <p className='text-muted-foreground text-xs'>{t('Empty body')}</p>
  }
  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <div className='flex items-center gap-2'>
        {props.base64 ? (
          <span className='text-muted-foreground text-xs'>
            {t('Binary body (base64)')}
          </span>
        ) : null}
        {props.truncated ? (
          <span className='text-muted-foreground text-xs'>
            {t('Truncated')}
          </span>
        ) : null}
        <CopyButton
          value={props.body}
          aria-label={t('Copy body')}
          tooltip={t('Copy body')}
        />
      </div>
      <pre className='bg-muted/50 max-h-64 min-w-0 overflow-auto rounded-md p-2 font-mono text-xs break-all whitespace-pre-wrap'>
        {props.body}
      </pre>
    </div>
  )
}

function MetaItem(props: { label: string; children: ReactNode }) {
  return (
    <div className='min-w-0'>
      <span className='text-muted-foreground text-xs'>{props.label}: </span>
      <span className='text-xs break-all'>{props.children}</span>
    </div>
  )
}

/**
 * Stored relay dump records: newest-first list with detail dialog and
 * delete/clear actions. Root users only.
 */
export function RelayDumpViewer() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RelayDumpEntry | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const listQuery = useQuery({
    queryKey: ['relay-dump', 'list', page],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RelayDumpListResponse }>(
        `/api/relay_dump/?page=${page}&page_size=${PAGE_SIZE}`
      )
      const payload = requireServerSuccess(res.data)
      return payload.data
    },
  })

  const detailQuery = useQuery({
    queryKey: ['relay-dump', 'detail', detailId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RelayDumpDetail }>(
        `/api/relay_dump/${encodeURIComponent(detailId ?? '')}`
      )
      const payload = requireServerSuccess(res.data)
      return payload.data
    },
    enabled: detailId !== null,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/relay_dump/${encodeURIComponent(id)}`)
      return requireServerSuccess(res.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-dump'] })
      toast.success(t('Capture deleted'))
    },
    onError: (error: Error) => handleServerError(error),
  })

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete('/api/relay_dump/')
      return requireServerSuccess(res.data)
    },
    onSuccess: (data: { success: boolean; data?: { deleted?: number } }) => {
      queryClient.invalidateQueries({ queryKey: ['relay-dump'] })
      toast.success(
        t('Deleted {{count}} captures', { count: data.data?.deleted ?? 0 })
      )
    },
    onError: (error: Error) => handleServerError(error),
  })

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (listQuery.isPending) {
    return <LoadingState title={t('Loading captures')} />
  }

  if (items.length === 0 && total === 0) {
    return (
      <div
        role='group'
        aria-label={t('Captured exchanges')}
        className='flex min-w-0 flex-col gap-4'
      >
        <ViewerHeader
          onClear={() => setConfirmClear(true)}
          clearDisabled={clearMutation.isPending}
        />
        <EmptyState
          title={t('No captures yet')}
          description={t(
            'Captures appear here when the relay dump is enabled and a matching request fails.'
          )}
        />
      </div>
    )
  }

  return (
    <div
      role='group'
      aria-label={t('Captured exchanges')}
      className='flex min-w-0 flex-col gap-4'
    >
      <ViewerHeader
        onClear={() => setConfirmClear(true)}
        clearDisabled={clearMutation.isPending}
      />
      <div className='min-w-0 overflow-x-auto rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Time')}</TableHead>
              <TableHead>{t('Model')}</TableHead>
              <TableHead>{t('Channel')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead className='text-right'>{t('Size')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className='whitespace-nowrap'>
                  {formatTimestampToDate(entry.created_at, 'milliseconds')}
                </TableCell>
                <TableCell className='max-w-48 truncate'>
                  {entry.model || '-'}
                </TableCell>
                <TableCell className='max-w-40 truncate'>
                  {entry.channel_name || entry.channel_id || '-'}
                </TableCell>
                <TableCell
                  className={cn('font-mono', statusClassName(entry.status_code))}
                >
                  {entry.status_code === 0 ? t('Network error') : entry.status_code}
                </TableCell>
                <TableCell className='text-right whitespace-nowrap'>
                  {formatBytes(entry.size)}
                </TableCell>
                <TableCell className='text-right whitespace-nowrap'>
                  <div className='flex justify-end gap-1'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => setDetailId(entry.id)}
                    >
                      {t('View')}
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      aria-label={t('Delete capture')}
                      onClick={() => setDeleteTarget(entry)}
                    >
                      <Trash2 className='size-4' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className='flex items-center justify-end gap-2 text-xs'>
        <span>
          {t('Page {{page}} of {{count}}', {
            page: page + 1,
            count: pageCount,
          })}
        </span>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          {t('Previous')}
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={page + 1 >= pageCount}
          onClick={() => setPage((current) => current + 1)}
        >
          {t('Next')}
        </Button>
      </div>

      <Dialog
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
        title={t('Capture detail')}
        description={detailQuery.data?.request_path}
        contentHeight='70vh'
      >
        {detailQuery.isPending ? (
          <LoadingState title={t('Loading capture')} />
        ) : detailQuery.data ? (
          <RelayDumpDetailBody detail={detailQuery.data} />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('Delete this capture?')}
        desc={t(
          'The capture of request {{id}} will be permanently deleted.',
          { id: deleteTarget?.request_id ?? '' }
        )}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id, {
              onSettled: () => setDeleteTarget(null),
            })
          }
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t('Clear all captures?')}
        desc={t('Every stored capture will be permanently deleted.')}
        destructive
        isLoading={clearMutation.isPending}
        handleConfirm={() => {
          clearMutation.mutate(undefined, {
            onSettled: () => setConfirmClear(false),
          })
        }}
      />
    </div>
  )
}

function ViewerHeader(props: {
  onClear: () => void
  clearDisabled: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-wrap items-end justify-between gap-2'>
      <div>
        <h4 className='font-medium'>{t('Captured exchanges')}</h4>
        <p className='text-muted-foreground mt-1 text-xs'>
          {t(
            'Newest captures first. Bodies are truncated to the configured limit and sensitive headers are redacted.'
          )}
        </p>
      </div>
      <Button
        type='button'
        variant='destructive'
        size='sm'
        onClick={props.onClear}
        disabled={props.clearDisabled}
      >
        {t('Clear all')}
      </Button>
    </div>
  )
}

function RelayDumpDetailBody(props: { detail: RelayDumpDetail }) {
  const { t } = useTranslation()
  const detail = props.detail
  return (
    <div className='flex min-w-0 flex-col gap-4'>
      <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
        <MetaItem label={t('Request ID')}>
          {detail.request_id}
        </MetaItem>
        <MetaItem label={t('Time')}>
          {formatTimestampToDate(detail.created_at, 'milliseconds')}
        </MetaItem>
        <MetaItem label={t('Duration')}>
          {detail.duration_ms} ms
        </MetaItem>
        <MetaItem label={t('Channel')}>
          {detail.channel_name
            ? `${detail.channel_name} (#${detail.channel_id})`
            : `#${detail.channel_id}`}
        </MetaItem>
        <MetaItem label={t('Model')}>{detail.model || '-'}</MetaItem>
        <MetaItem label={t('Stream')}>
          {detail.is_stream ? t('Yes') : t('No')}
        </MetaItem>
      </div>

      {detail.error ? (
        <div className='text-destructive text-xs break-all'>
          {t('Error')}: {detail.error}
        </div>
      ) : null}

      <section className='flex min-w-0 flex-col gap-2'>
        <h5 className='font-medium'>
          {t('Request')}
          {detail.request?.method ? ` · ${detail.request.method}` : ''}
        </h5>
        {detail.request?.url ? (
          <p className='font-mono text-xs break-all'>{detail.request.url}</p>
        ) : null}
        <HeadersList headers={detail.request?.headers} />
        <BodyBlock
          body={detail.request?.body}
          truncated={detail.request?.body_truncated}
          base64={detail.request?.body_base64}
          missing={detail.request?.body_missing}
        />
      </section>

      <section className='flex min-w-0 flex-col gap-2'>
        <h5 className='font-medium'>
          {t('Response')}
          {detail.response?.status_code
            ? ` · ${detail.response.status_code}`
            : ''}
        </h5>
        <HeadersList headers={detail.response?.headers} />
        <BodyBlock
          body={detail.response?.body}
          truncated={detail.response?.body_truncated}
          base64={detail.response?.body_base64}
          missing={detail.response?.body_missing}
        />
      </section>
    </div>
  )
}
