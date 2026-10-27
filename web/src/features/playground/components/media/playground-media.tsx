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
import {
  DownloadIcon,
  Loader2Icon,
  RefreshCwIcon,
  RotateCcwIcon,
  SendIcon,
  Trash2Icon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatQuota } from '@/lib/format'

import {
  deleteGenerationRecord,
  fetchGenerationRecords,
  fetchVideoTask,
  generateImage,
  submitVideoTask,
} from '../../api'
import {
  IMAGE_SIZE_OPTIONS,
  UNSET_OPTION_VALUE,
  VIDEO_RESOLUTION_OPTIONS,
  VIDEO_SECONDS_OPTIONS,
  VIDEO_TASK_POLL_INTERVAL_MS,
} from '../../constants'
import type { GenerationRecord, ModelOption } from '../../types'

interface PlaygroundMediaProps {
  mode: 'image' | 'video'
  models: ModelOption[]
  modelValue: string
  isModelLoading?: boolean
  onModelChange: (value: string) => void
}

// A task that never reported a final state stops being polled, and stops looking
// like it is still rendering: the browser may have been closed mid-render, and
// the row would otherwise spin forever.
const STALE_PENDING_MS = 10 * 60 * 1000

const HISTORY_PAGE_SIZE = 50

function readErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as {
    response?: { data?: { error?: { message?: string }; message?: string } }
    message?: string
  }
  return (
    candidate?.response?.data?.error?.message ||
    candidate?.response?.data?.message ||
    candidate?.message ||
    fallback
  )
}

function describeError(
  error: unknown,
  fallback: string,
  busyMessage: string
): string {
  const message = readErrorMessage(error, fallback)
  return /overloaded/i.test(message) ? busyMessage : message
}

function isPending(record: GenerationRecord): boolean {
  return record.status === 'queued' || record.status === 'running'
}

function isStale(record: GenerationRecord): boolean {
  return isPending(record) && Date.now() - record.created_at * 1000 > STALE_PENDING_MS
}

function paramText(
  params: Record<string, string | number> | undefined,
  keys: string[]
): string {
  if (!params) return ''
  for (const key of keys) {
    const value = params[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value)
    }
  }
  return ''
}

export function PlaygroundMedia({
  mode,
  models,
  modelValue,
  isModelLoading = false,
  onModelChange,
}: PlaygroundMediaProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState<string>(UNSET_OPTION_VALUE)
  const [seconds, setSeconds] = useState<string>(UNSET_OPTION_VALUE)
  const [resolution, setResolution] = useState<string>(UNSET_OPTION_VALUE)
  const [records, setRecords] = useState<GenerationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const activeModel = useMemo(
    () => models.find((model) => model.value === modelValue)?.value ?? '',
    [models, modelValue]
  )

  // The list is served by the gateway, so it is the only source of truth: a
  // refresh, a new tab, or another device all show the same history.
  const refresh = useCallback(async () => {
    try {
      const page = await fetchGenerationRecords({
        kind: mode,
        pageSize: HISTORY_PAGE_SIZE,
      })
      setRecords(page.items)
    } catch (error) {
      setNotice(
        describeError(
          error,
          t('Generation failed'),
          t('Server is busy, please try again shortly.')
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [mode, t])

  // The relay writes the history row while it is still finishing the response,
  // so a re-read issued as soon as the request resolves can land before the row
  // exists and leave the page looking like nothing happened. Poll briefly until
  // the new row shows up instead of trusting a single read.
  const refreshUntilNewRecord = useCallback(
    async (knownTopId: number) => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const page = await fetchGenerationRecords({
            kind: mode,
            pageSize: HISTORY_PAGE_SIZE,
          })
          setRecords(page.items)
          if ((page.items[0]?.id ?? 0) > knownTopId) return
        } catch (error) {
          setNotice(
            describeError(
              error,
              t('Generation failed'),
              t('Server is busy, please try again shortly.')
            )
          )
          return
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, 400)
        })
      }
    },
    [mode, t]
  )

  // Switching between image and video shows that mode's own history.
  useEffect(() => {
    setRecords([])
    setPrompt('')
    setNotice('')
    setIsLoading(true)
    void refresh()
  }, [mode, refresh])

  const pendingTaskIds = useMemo(
    () =>
      records
        .filter((record) => isPending(record) && record.task_id && !isStale(record))
        .map((record) => record.task_id as string),
    [records]
  )

  // Poll every queued video task until it reaches a final state. The server
  // writes the outcome into the row, so each tick simply re-reads the list.
  useEffect(() => {
    if (pendingTaskIds.length === 0) return
    let cancelled = false

    const poll = async () => {
      for (const taskId of pendingTaskIds) {
        if (cancelled) return
        try {
          await fetchVideoTask(taskId)
        } catch {
          // The task lives on the server; a single failed poll is not the end.
        }
      }
      if (!cancelled) {
        await refresh()
      }
    }

    const timer = window.setInterval(() => void poll(), VIDEO_TASK_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTaskIds.join(','), refresh])

  const canSubmit = Boolean(activeModel) && prompt.trim().length > 0 && !isSubmitting

  const handleSubmit = async () => {
    const trimmed = prompt.trim()
    if (!activeModel || !trimmed || isSubmitting) return

    const knownTopId = records[0]?.id ?? 0
    setIsSubmitting(true)
    setNotice('')
    try {
      if (mode === 'image') {
        await generateImage({
          model: activeModel,
          prompt: trimmed,
          ...(size !== UNSET_OPTION_VALUE ? { size } : {}),
        })
      } else {
        await submitVideoTask({
          model: activeModel,
          prompt: trimmed,
          ...(seconds !== UNSET_OPTION_VALUE ? { seconds } : {}),
          ...(resolution !== UNSET_OPTION_VALUE
            ? { metadata: { resolution } }
            : {}),
        })
      }
      setPrompt('')
      await refreshUntilNewRecord(knownTopId)
    } catch (error) {
      setNotice(
        describeError(
          error,
          t('Generation failed'),
          t('Server is busy, please try again shortly.')
        )
      )
      await refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (record: GenerationRecord) => {
    if (!window.confirm(t('Delete this record? The generated file is deleted too.'))) {
      return
    }
    setDeletingId(record.id)
    try {
      await deleteGenerationRecord(record.id)
      setRecords((current) => current.filter((item) => item.id !== record.id))
    } catch (error) {
      setNotice(readErrorMessage(error, t('Generation failed')))
    } finally {
      setDeletingId(null)
    }
  }

  // Reuse puts the prompt and the settings back into the composer, so a result
  // the user liked can be re-run with one edit instead of retyping.
  const handleReuse = (record: GenerationRecord) => {
    setPrompt(record.prompt)
    if (record.model) onModelChange(record.model)
    if (record.kind === 'image') {
      const reuseSize = paramText(record.params, ['size'])
      setSize(reuseSize || UNSET_OPTION_VALUE)
      return
    }
    const reuseSeconds = paramText(record.params, ['seconds', 'duration'])
    setSeconds(reuseSeconds || UNSET_OPTION_VALUE)
    const reuseResolution = paramText(record.params, ['resolution'])
    setResolution(reuseResolution || UNSET_OPTION_VALUE)
  }

  const renderParams = () => {
    if (mode === 'image') {
      return (
        <Select value={size} onValueChange={(value) => setSize(value ?? UNSET_OPTION_VALUE)}>
          <SelectTrigger className='h-8 w-40 text-xs' size='sm'>
            <SelectValue placeholder={t('Size')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET_OPTION_VALUE}>
              {t('Size')}: {t('Unset')}
            </SelectItem>
            {IMAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    return (
      <>
        <Select value={seconds} onValueChange={(value) => setSeconds(value ?? UNSET_OPTION_VALUE)}>
          <SelectTrigger className='h-8 w-36 text-xs' size='sm'>
            <SelectValue placeholder={t('Video length')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET_OPTION_VALUE}>
              {t('Video length')}: {t('Unset')}
            </SelectItem>
            {VIDEO_SECONDS_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}s
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={resolution} onValueChange={(value) => setResolution(value ?? UNSET_OPTION_VALUE)}>
          <SelectTrigger className='h-8 w-32 text-xs' size='sm'>
            <SelectValue placeholder={t('Resolution')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET_OPTION_VALUE}>
              {t('Resolution')}: {t('Unset')}
            </SelectItem>
            {VIDEO_RESOLUTION_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </>
    )
  }

  const renderRecord = (record: GenerationRecord) => {
    const stale = isStale(record)
    const settings = [
      paramText(record.params, ['size']),
      paramText(record.params, ['seconds', 'duration'])
        ? `${paramText(record.params, ['seconds', 'duration'])}s`
        : '',
      paramText(record.params, ['resolution']),
    ].filter((value) => value.length > 0)

    return (
      <div
        key={record.id}
        className='border-border/70 bg-background/95 rounded-xl border p-4 shadow-sm'
      >
        <div className='mb-3 flex flex-wrap items-start gap-2'>
          <p className='min-w-0 flex-1 text-sm break-words'>{record.prompt}</p>
          <span className='bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px]'>
            {record.model}
          </span>
          {settings.map((value) => (
            <span
              key={value}
              className='bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px]'
            >
              {value}
            </span>
          ))}
        </div>

        <div className='text-muted-foreground mb-3 flex flex-wrap items-center gap-3 text-[11px]'>
          <span>
            {new Date(record.created_at * 1000).toLocaleString()}
          </span>
          {record.quota > 0 ? <span>{formatQuota(record.quota)}</span> : null}
        </div>

        {isPending(record) && !stale ? (
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <Loader2Icon className='size-3.5 animate-spin' />
            <span>{t('Generating')}</span>
          </div>
        ) : null}

        {stale ? (
          <p className='text-muted-foreground text-xs'>
            {t('Interrupted')}: {t('This task stopped responding. Submit it again.')}
          </p>
        ) : null}

        {record.status === 'failure' && record.fail_reason ? (
          <p className='text-destructive text-xs break-words'>{record.fail_reason}</p>
        ) : null}

        {record.kind === 'image' && record.urls.length > 0 ? (
          <div className='flex flex-wrap gap-3'>
            {record.urls.map((url) => (
              <div key={url} className='group relative'>
                <img
                  alt={record.prompt}
                  className='border-border/60 max-h-72 rounded-lg border object-contain'
                  src={url}
                />
                <a
                  className='bg-background/90 text-foreground border-border/60 absolute right-2 bottom-2 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100'
                  download
                  href={url}
                  rel='noreferrer'
                  target='_blank'
                >
                  <DownloadIcon className='size-3' />
                  {t('Download')}
                </a>
              </div>
            ))}
          </div>
        ) : null}

        {record.kind === 'video' && record.urls.length > 0 ? (
          <div className='space-y-2'>
            <video
              className='border-border/60 w-full max-w-xl rounded-lg border'
              controls
              src={record.urls[0]}
            />
            <a
              className='text-primary inline-flex items-center gap-1 text-xs hover:underline'
              download
              href={record.urls[0]}
              rel='noreferrer'
              target='_blank'
            >
              <DownloadIcon className='size-3' />
              {t('Download')}
            </a>
          </div>
        ) : null}

        <div className='mt-3 flex items-center gap-1'>
          <Button
            className='text-muted-foreground hover:text-foreground h-7 px-2 text-[11px]'
            onClick={() => handleReuse(record)}
            size='sm'
            type='button'
            variant='ghost'
          >
            <RotateCcwIcon className='size-3' />
            {t('Reuse')}
          </Button>
          <div className='flex-1' />
          <Button
            className='text-muted-foreground hover:text-destructive h-7 px-2 text-[11px]'
            disabled={deletingId === record.id}
            onClick={() => void handleDelete(record)}
            size='sm'
            type='button'
            variant='ghost'
          >
            {deletingId === record.id ? (
              <Loader2Icon className='size-3 animate-spin' />
            ) : (
              <Trash2Icon className='size-3' />
            )}
            {t('Delete')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='flex size-full min-h-0 flex-col overflow-hidden'>
      <div className='min-h-0 flex-1 overflow-y-auto px-1'>
        <div className='mx-auto w-full max-w-4xl space-y-4 py-6'>
          <div className='flex items-center gap-2'>
            <h2 className='text-sm font-medium'>{t('Generation history')}</h2>
            <Button
              className='text-muted-foreground hover:text-foreground h-6 px-1.5'
              onClick={() => void refresh()}
              size='sm'
              type='button'
              variant='ghost'
            >
              <RefreshCwIcon className='size-3' />
            </Button>
          </div>

          {isLoading ? (
            <div className='text-muted-foreground flex items-center gap-2 py-10 text-xs'>
              <Loader2Icon className='size-3.5 animate-spin' />
              <span>{t('Loading...')}</span>
            </div>
          ) : records.length === 0 ? (
            <div className='text-muted-foreground flex flex-col items-center gap-2 py-12 text-center text-sm'>
              <p className='text-foreground text-base font-medium'>
                {mode === 'image' ? t('Image generation') : t('Video generation')}
              </p>
              <p>
                {mode === 'image'
                  ? t('Describe the image you want, then generate it.')
                  : t('Describe the video you want, then generate it.')}
              </p>
              <p className='text-xs'>{t('No history yet')}</p>
              {!isModelLoading && models.length === 0 ? (
                <p className='text-destructive'>{t('No model available')}</p>
              ) : null}
            </div>
          ) : (
            records.map(renderRecord)
          )}

          {notice ? (
            <p className='text-destructive border-destructive/30 rounded-lg border px-3 py-2 text-xs break-words'>
              {notice}
            </p>
          ) : null}
        </div>
      </div>

      <div className='mx-auto w-full max-w-4xl px-1 md:pb-4'>
        <div className='border-border/70 bg-background/95 rounded-xl border p-3 shadow-[0_18px_60px_-32px_rgba(0,0,0,0.65)]'>
          <Textarea
            className='min-h-20 resize-none border-0 px-2 pt-1 text-sm shadow-none focus-visible:ring-0'
            disabled={isSubmitting}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void handleSubmit()
              }
            }}
            placeholder={
              mode === 'image'
                ? t('Describe the image you want')
                : t('Describe the video you want')
            }
            value={prompt}
          />

          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <Select
              value={modelValue}
              onValueChange={(value) => {
                if (value) onModelChange(value)
              }}
            >
              <SelectTrigger className='h-8 max-w-64 text-xs' size='sm'>
                <SelectValue placeholder={t('Model')} />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {renderParams()}

            <div className='flex-1' />

            <Button
              className='h-8 px-3 text-xs'
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
              size='sm'
              type='button'
            >
              {isSubmitting ? (
                <Loader2Icon className='size-3.5 animate-spin' />
              ) : (
                <SendIcon className='size-3.5' />
              )}
              {isSubmitting ? t('Generating') : t('Generate')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
