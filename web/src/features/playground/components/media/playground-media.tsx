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
import { DownloadIcon, Loader2Icon, SendIcon } from 'lucide-react'
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

import { fetchVideoTask, generateImage, submitVideoTask } from '../../api'
import {
  IMAGE_SIZE_OPTIONS,
  UNSET_OPTION_VALUE,
  VIDEO_RESOLUTION_OPTIONS,
  VIDEO_SECONDS_OPTIONS,
  VIDEO_TASK_POLL_INTERVAL_MS,
} from '../../constants'
import type { MediaGenerationItem, ModelOption } from '../../types'

interface PlaygroundMediaProps {
  mode: 'image' | 'video'
  models: ModelOption[]
  modelValue: string
  isModelLoading?: boolean
  onModelChange: (value: string) => void
}

function readErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as {
    response?: { data?: { error?: { message?: string } } }
    message?: string
  }
  return (
    candidate?.response?.data?.error?.message ||
    candidate?.message ||
    fallback
  )
}

function buildImageSource(entry: { url?: string; b64_json?: string }): string {
  if (entry.url) return entry.url
  if (entry.b64_json) return `data:image/png;base64,${entry.b64_json}`
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
  const [items, setItems] = useState<MediaGenerationItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeModel = useMemo(
    () => models.find((model) => model.value === modelValue)?.value ?? '',
    [models, modelValue]
  )

  const updateItems = useCallback(
    (
      updater: (current: MediaGenerationItem[]) => MediaGenerationItem[]
    ) => {
      setItems((current) => updater(current))
    },
    []
  )

  const patchItem = useCallback(
    (key: string, patch: Partial<MediaGenerationItem>) => {
      updateItems((current) =>
        current.map((item) => (item.key === key ? { ...item, ...patch } : item))
      )
    },
    [updateItems]
  )

  // Reset the one-shot history when the user switches between image and video:
  // a video card in the image tab would only be a stale leftover.
  useEffect(() => {
    updateItems(() => [])
    setPrompt('')
  }, [mode, updateItems])

  // Poll every queued video task until it reports a result. A task can outlive
  // the browser tab, so a failed poll keeps the card running instead of
  // dropping the id the user would need to check again.
  const pendingTasks = items
    .filter((item) => item.status === 'running' && item.taskId)
    .map((item) => ({ key: item.key, taskId: item.taskId as string }))

  useEffect(() => {
    if (pendingTasks.length === 0) return
    let cancelled = false

    const poll = async () => {
      for (const task of pendingTasks) {
        if (cancelled) return
        try {
          const payload = await fetchVideoTask(task.taskId)
          const data = payload?.data
          if (!data) continue
          const status = String(data.status ?? '').toUpperCase()
          if (status === 'SUCCESS') {
            patchItem(task.key, {
              status: 'done',
              videoUrl: data.result_url,
              progress: '100%',
            })
          } else if (status === 'FAILURE') {
            patchItem(task.key, {
              status: 'error',
              errorMessage: data.fail_reason || t('Generation failed'),
            })
          } else if (data.progress) {
            patchItem(task.key, { progress: data.progress })
          }
        } catch {
          // Keep polling: the task lives on the server, not in this request.
        }
      }
    }

    const timer = window.setInterval(poll, VIDEO_TASK_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTasks.map((task) => task.taskId).join(','), patchItem, t])

  const canSubmit = Boolean(activeModel) && prompt.trim().length > 0 && !isSubmitting

  const handleSubmit = async () => {
    const trimmed = prompt.trim()
    if (!activeModel || !trimmed || isSubmitting) return

    const key = `${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setIsSubmitting(true)
    updateItems((current) => [
      {
        key,
        mode,
        prompt: trimmed,
        model: activeModel,
        status: 'running',
      },
      ...current,
    ])
    setPrompt('')

    try {
      if (mode === 'image') {
        const payload = await generateImage({
          model: activeModel,
          prompt: trimmed,
          ...(size !== UNSET_OPTION_VALUE ? { size } : {}),
        })
        const images = (payload?.data ?? [])
          .map((entry) => buildImageSource(entry))
          .filter((source) => source.length > 0)
        if (images.length === 0) {
          patchItem(key, {
            status: 'error',
            errorMessage:
              payload?.error?.message || t('The model returned no result'),
          })
        } else {
          patchItem(key, { status: 'done', images })
        }
      } else {
        const payload = await submitVideoTask({
          model: activeModel,
          prompt: trimmed,
          ...(seconds !== UNSET_OPTION_VALUE ? { seconds } : {}),
          ...(resolution !== UNSET_OPTION_VALUE
            ? { metadata: { resolution } }
            : {}),
        })
        const taskId = payload?.task_id || payload?.id
        if (!taskId) {
          patchItem(key, {
            status: 'error',
            errorMessage:
              payload?.error?.message || t('The model returned no result'),
          })
        } else {
          patchItem(key, { taskId, progress: payload?.status })
        }
      }
    } catch (error) {
      patchItem(key, {
        status: 'error',
        errorMessage: readErrorMessage(error, t('Generation failed')),
      })
    } finally {
      setIsSubmitting(false)
    }
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

  return (
    <div className='flex size-full min-h-0 flex-col overflow-hidden'>
      <div className='min-h-0 flex-1 overflow-y-auto px-1'>
        <div className='mx-auto w-full max-w-4xl space-y-4 py-6'>
          {items.length === 0 ? (
            <div className='text-muted-foreground flex flex-col items-center gap-2 py-16 text-center text-sm'>
              <p className='text-foreground text-base font-medium'>
                {mode === 'image' ? t('Image generation') : t('Video generation')}
              </p>
              <p>
                {mode === 'image'
                  ? t('Describe the image you want, then generate it.')
                  : t('Describe the video you want, then generate it.')}
              </p>
              {!isModelLoading && models.length === 0 ? (
                <p className='text-destructive'>{t('No model available')}</p>
              ) : null}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.key}
                className='border-border/70 bg-background/95 rounded-xl border p-4 shadow-sm'
              >
                <div className='mb-3 flex flex-wrap items-start gap-2'>
                  <p className='min-w-0 flex-1 text-sm break-words'>
                    {item.prompt}
                  </p>
                  <span className='bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px]'>
                    {item.model}
                  </span>
                </div>

                {item.status === 'running' ? (
                  <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                    <Loader2Icon className='size-3.5 animate-spin' />
                    <span>
                      {item.taskId
                        ? `${t('Generating')}${item.progress ? ` · ${item.progress}` : ''}`
                        : t('Generating')}
                    </span>
                  </div>
                ) : null}

                {item.status === 'error' ? (
                  <p className='text-destructive text-xs break-words'>
                    {item.errorMessage || t('Generation failed')}
                  </p>
                ) : null}

                {item.images?.length ? (
                  <div className='flex flex-wrap gap-3'>
                    {item.images.map((source) => (
                      <div key={source} className='group relative'>
                        <img
                          alt={item.prompt}
                          className='border-border/60 max-h-72 rounded-lg border object-contain'
                          src={source}
                        />
                        <a
                          className='bg-background/90 text-foreground border-border/60 absolute right-2 bottom-2 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100'
                          download
                          href={source}
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

                {item.videoUrl ? (
                  <div className='space-y-2'>
                    <video
                      className='border-border/60 w-full max-w-xl rounded-lg border'
                      controls
                      src={item.videoUrl}
                    />
                    <a
                      className='text-primary inline-flex items-center gap-1 text-xs hover:underline'
                      download
                      href={item.videoUrl}
                      rel='noreferrer'
                      target='_blank'
                    >
                      <DownloadIcon className='size-3' />
                      {t('Download')}
                    </a>
                  </div>
                ) : null}
              </div>
            ))
          )}
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
