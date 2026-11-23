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
import { useMutation } from '@tanstack/react-query'
import { ArrowDown, ArrowRight, Play, Sparkles } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { JsonCodeEditor } from '@/components/json-code-editor'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { TaskPluginOption } from '@/features/channels/api'
import { RequestPluginRecord } from '@/features/usage-logs/components/request-plugin-record'
import type { RequestPluginRecordEntry } from '@/features/usage-logs/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatBytes, formatNumber } from '@/lib/format'
import { resolveLocalizedText } from '@/lib/localized-text'
import { getServerErrorMessage } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { dryRunRequestPlugins } from '../api'
import {
  REQUEST_PLUGIN_SAMPLE_IMAGE,
  requestPluginSampleBody,
  requestPluginSampleHasImage,
  requestPluginSamplesFor,
  requestPluginSampleTexts,
} from '../lib/request-plugin-samples'
import {
  REQUEST_PLUGIN_DRY_RUN_FORMATS,
  REQUEST_PLUGIN_EFFORT_LABELS,
  requestPluginDryRunExample,
  requestPluginDryRunPath,
} from '../lib/request-plugins'
import { diffText } from '../lib/text-diff'
import type {
  RequestPluginDryRunResult,
  RequestPluginInstance,
  RequestPluginSample,
} from '../types'

type RequestPluginTryPanelProps = {
  plugin: TaskPluginOption
  /** The instance as edited; null while its settings have problems. */
  instance: RequestPluginInstance | null
}

const SAMPLE_FORMAT = REQUEST_PLUGIN_DRY_RUN_FORMATS[0]

let sampleImage: string | null | undefined

/**
 * A dusk landscape drawn once per page: a PNG of about 690 KB that a lossless
 * WebP makes much smaller, so image plugins show their work with defaults.
 */
function drawSampleImage(): string | null {
  if (sampleImage !== undefined) return sampleImage
  sampleImage = null
  const width = 2000
  const height = 1250
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  const sky = context.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#1e3a8a')
  sky.addColorStop(0.45, '#7c3aed')
  sky.addColorStop(0.75, '#f472b6')
  sky.addColorStop(1, '#fdba74')
  context.fillStyle = sky
  context.fillRect(0, 0, width, height)
  const sun = context.createRadialGradient(
    width * 0.7,
    height * 0.62,
    0,
    width * 0.7,
    height * 0.62,
    height * 0.35
  )
  sun.addColorStop(0, 'rgba(255, 237, 160, 1)')
  sun.addColorStop(0.3, 'rgba(253, 186, 116, 0.8)')
  sun.addColorStop(1, 'rgba(253, 186, 116, 0)')
  context.fillStyle = sun
  context.fillRect(0, 0, width, height)
  const hills: [string, number, number][] = [
    ['#4c1d95', 0.7, 0.08],
    ['#3b0764', 0.8, 0.06],
    ['#1e1b4b', 0.9, 0.05],
  ]
  for (const [color, base, amplitude] of hills) {
    context.beginPath()
    context.moveTo(0, height)
    for (let x = 0; x <= width; x += 8) {
      const wave =
        Math.sin((x / width) * 9 + base * 10) + Math.sin((x / width) * 23) * 0.3
      context.lineTo(x, height * base + wave * height * amplitude)
    }
    context.lineTo(width, height)
    context.closePath()
    context.fillStyle = color
    context.fill()
  }
  sampleImage = canvas.toDataURL('image/png')
  return sampleImage
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** The MIME type of an object that holds an image as base64 data. */
function imageMime(object: Record<string, unknown>) {
  const mime = object.media_type ?? object.mimeType ?? object.mime_type
  return typeof mime === 'string' &&
    mime.startsWith('image/') &&
    typeof object.data === 'string'
    ? mime
    : undefined
}

/**
 * The images of a request body in the order the gateway numbers them: data
 * URLs, and base64 data next to an image MIME type.
 */
function requestImages(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) found.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) requestImages(item, found)
  } else if (isObject(value)) {
    const mime = imageMime(value)
    if (mime) found.push(`data:${mime};base64,${value.data}`)
    else for (const member of Object.values(value)) requestImages(member, found)
  }
  return found
}

type ChangedText = { path: string; before: string; after: string }

/**
 * Up to three texts the run rewrote, in document order: strings at the same
 * place in both bodies that differ. Images are left out.
 */
function changedTexts(
  before: unknown,
  after: unknown,
  path = '',
  found: ChangedText[] = []
): ChangedText[] {
  if (found.length === 3) return found
  if (typeof before === 'string' && typeof after === 'string') {
    if (
      before !== after &&
      !before.startsWith('data:') &&
      !after.startsWith('data:')
    ) {
      found.push({ path, before, after })
    }
  } else if (Array.isArray(before) && Array.isArray(after)) {
    after.forEach((item, index) =>
      changedTexts(before[index], item, `${path}/${index}`, found)
    )
  } else if (isObject(before) && isObject(after) && !imageMime(after)) {
    for (const [key, value] of Object.entries(after)) {
      changedTexts(before[key], value, `${path}/${key}`, found)
    }
  }
  return found
}

function dataUrlBytes(url: string) {
  const data = url.slice(url.indexOf(',') + 1)
  return (
    Math.floor((data.length * 3) / 4) - (data.match(/=*$/)?.[0].length ?? 0)
  )
}

function useImageSize(src: string | undefined) {
  const [size, setSize] = useState<{
    src: string
    width: number
    height: number
  }>()
  useEffect(() => {
    if (!src) return
    const image = new Image()
    image.addEventListener(
      'load',
      () =>
        setSize({
          src,
          width: image.naturalWidth,
          height: image.naturalHeight,
        }),
      { once: true }
    )
    image.src = src
  }, [src])
  return size?.src === src ? size : undefined
}

/** An image with its type, size and pixel dimensions. */
function ImageFacts(props: {
  label: string
  src?: string
  mime: string
  bytes: number
  children?: ReactNode
}) {
  const { i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const size = useImageSize(props.src)
  return (
    <div className='bg-background flex items-center gap-3 rounded-xl border p-3'>
      <span className='bg-muted grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg'>
        {props.src && (
          <img src={props.src} alt='' className='size-full object-cover' />
        )}
      </span>
      <div className='min-w-0 flex-1 text-sm'>
        <p className='font-medium'>{props.label}</p>
        <p className='text-muted-foreground text-xs'>
          {props.mime.replace('image/', '').toUpperCase()} ·{' '}
          {formatBytes(props.bytes, locale)}
        </p>
        {size && (
          <p className='text-muted-foreground text-xs'>
            {formatNumber(size.width, locale)} ×{' '}
            {formatNumber(size.height, locale)}
          </p>
        )}
      </div>
      {props.children}
    </div>
  )
}

function ArrowStep() {
  return (
    <div className='flex justify-center' aria-hidden='true'>
      <span className='bg-background text-muted-foreground grid size-6 place-items-center rounded-full border'>
        <ArrowDown className='size-3.5' />
      </span>
    </div>
  )
}

/** One text before and after, with the changed words marked. */
function TextChange(props: {
  before: string
  after: string
  beforeLabel?: string
  afterLabel?: string
}) {
  const { t } = useTranslation()
  const parts = diffText(props.before, props.after)
  const side = (kind: 'removed' | 'added') => {
    // Texts too long to compare show as they are.
    if (!parts) return kind === 'removed' ? props.before : props.after
    let offset = 0
    return parts
      .filter((part) => part.kind === 'same' || part.kind === kind)
      .map((part) => {
        const start = offset
        offset += part.text.length
        if (part.kind === 'same') return part.text
        return (
          <mark
            key={start}
            className={cn(
              'rounded px-0.5',
              kind === 'removed'
                ? 'bg-warning/15 decoration-warning text-foreground underline decoration-dotted underline-offset-4'
                : 'bg-primary/10 text-primary'
            )}
          >
            {part.text}
          </mark>
        )
      })
  }
  return (
    <>
      <div className='bg-background space-y-1 rounded-xl border p-3'>
        <p className='text-muted-foreground text-xs'>
          {props.beforeLabel ?? t('Original text')}
        </p>
        <p className='line-clamp-6 text-sm leading-6 break-words'>
          {side('removed')}
        </p>
      </div>
      <ArrowStep />
      <div className='bg-background space-y-1 rounded-xl border p-3'>
        <p className='text-muted-foreground text-xs'>
          {props.afterLabel ?? t('Sent upstream')}
        </p>
        <p className='line-clamp-6 text-sm leading-6 break-words'>
          {side('added')}
        </p>
      </div>
    </>
  )
}

/** The effort a request had before the plugins ran and the one they set. */
function EffortChange(props: { before: string; after: string }) {
  const { t } = useTranslation()
  const title = (effort: string) => {
    if (!effort) return t('Not set')
    const label = REQUEST_PLUGIN_EFFORT_LABELS[effort]
    return label ? t(label) : effort
  }
  return (
    <div
      role='group'
      aria-label={t('Reasoning Effort')}
      className='bg-background flex items-center justify-between gap-3 rounded-xl border p-3 text-sm'
    >
      <span className='text-muted-foreground text-xs'>
        {t('Reasoning Effort')}
      </span>
      <span className='flex items-center gap-2'>
        <span className='text-muted-foreground'>{title(props.before)}</span>
        <ArrowRight
          aria-hidden='true'
          className='text-muted-foreground size-3.5'
        />
        <span className='text-primary font-medium'>{title(props.after)}</span>
      </span>
    </div>
  )
}

function TryResult(props: {
  plugin: TaskPluginOption
  sent: unknown
  /** The answer the reply checks read, when the run had one. */
  sentReply?: string
  result: RequestPluginDryRunResult
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const result = props.result
  const entries = (result.record ?? []).filter(
    (item): item is RequestPluginRecordEntry => 'plugin' in item
  )
  const duration = (result.steps ?? []).reduce(
    (total, step) => total + (step.duration_ms ?? 0),
    0
  )
  const before = requestImages(props.sent)
  const after = requestImages(result.body)
  const media = entries.flatMap((entry) => entry.media ?? [])
  const texts = changedTexts(props.sent, result.body)
  const reply = result.reply
  const replyMasked =
    reply && props.sentReply !== undefined && reply.text !== props.sentReply
  const changed =
    replyMasked ||
    reply?.stopped ||
    entries.some(
      (entry) =>
        entry.changes?.length ||
        entry.media?.length ||
        entry.headers?.set?.length ||
        entry.headers?.remove?.length ||
        entry.reasoning_effort ||
        entry.findings?.length ||
        entry.masked
    )
  // An optional plugin's failure is skipped, so only its step tells of it.
  const failedStep = (result.steps ?? []).find((step) => step.error)
  const failure =
    result.failed ??
    (failedStep
      ? { instance: failedStep.instance, error: failedStep.error ?? '' }
      : null)
  // A plugin that fails while checking the answer stops the reply, not the
  // request.
  const failedOnReply = failedStep?.stage === 'reply'
  let failedTitle = t('The plugin failed, so the request would be refused')
  if (failedOnReply && props.plugin.optional) {
    failedTitle = t(
      'The plugin failed, so the reply goes on without its changes'
    )
  } else if (failedOnReply) {
    failedTitle = t('The plugin failed, so the reply would be stopped')
  } else if (props.plugin.optional) {
    failedTitle = t(
      'The plugin failed, so the request goes on without its changes'
    )
  }

  let outcome: ReactNode
  if (result.rejected) {
    outcome = (
      <div className='border-destructive/30 bg-destructive/5 space-y-1 rounded-xl border p-3 text-sm'>
        <p className='text-destructive font-medium'>
          {t('This request would be refused')}
        </p>
        {result.rejected.message && <p>{result.rejected.message}</p>}
        <p className='text-muted-foreground font-mono text-xs'>
          {result.rejected.code}
        </p>
      </div>
    )
  } else if (failure) {
    outcome = (
      <div className='border-warning/40 bg-warning/5 space-y-1 rounded-xl border p-3 text-sm'>
        <p className='font-medium'>{failedTitle}</p>
        <p className='text-muted-foreground font-mono text-xs break-all'>
          {failure.error}
        </p>
      </div>
    )
  } else if (!changed) {
    outcome = (
      <p className='bg-background text-muted-foreground rounded-xl border p-3 text-sm'>
        {reply
          ? t('No changes. The request and the reply go through as they are.')
          : t('No changes. The request is sent as it is.')}
      </p>
    )
  }

  let replyOutcome: ReactNode
  if (reply?.stopped) {
    replyOutcome = (
      <div className='border-destructive/30 bg-destructive/5 space-y-1 rounded-xl border p-3 text-sm'>
        <p className='text-destructive font-medium'>
          {t('This reply would be stopped')}
        </p>
        {reply.stopped.message && <p>{reply.stopped.message}</p>}
        <p className='text-muted-foreground font-mono text-xs'>
          {reply.stopped.code}
        </p>
      </div>
    )
  } else if (reply && replyMasked) {
    replyOutcome = (
      <TextChange
        before={props.sentReply ?? ''}
        after={reply.text}
        beforeLabel={t('Answer from the model')}
        afterLabel={t('Sent to the client')}
      />
    )
  }

  return (
    <div className='space-y-2'>
      {outcome}
      {!result.rejected &&
        media.map((change) => {
          const saved = 1 - change.to.bytes / change.from.bytes
          return (
            <div key={change.index} className='space-y-2'>
              <ImageFacts
                label={t('Original image')}
                src={before[change.index]}
                mime={change.from.mime}
                bytes={change.from.bytes}
              />
              <ArrowStep />
              <ImageFacts
                label={t('Sent upstream')}
                src={after[change.index]}
                mime={change.to.mime}
                bytes={change.to.bytes}
              >
                {saved > 0 && (
                  <span className='text-success text-2xl font-semibold tabular-nums'>
                    −{formatNumber(Math.round(saved * 100), locale)}%
                  </span>
                )}
              </ImageFacts>
            </div>
          )
        })}
      {!result.rejected &&
        texts.map((text) => (
          <div key={text.path} className='space-y-2'>
            <TextChange before={text.before} after={text.after} />
          </div>
        ))}
      {!result.rejected && result.reasoning_effort && (
        <EffortChange
          before={result.reasoning_effort_before ?? ''}
          after={result.reasoning_effort}
        />
      )}
      {!result.rejected && replyOutcome}
      {entries.length > 0 && (
        <div className='space-y-1.5 pt-2'>
          <p className='text-muted-foreground text-xs'>
            {t('What the usage log shows')}
          </p>
          <div className='bg-background rounded-xl border p-3'>
            <RequestPluginRecord items={entries} />
          </div>
        </div>
      )}
      <p className='text-muted-foreground pt-1 text-[11px]'>
        {t('Took {{ms}} ms', {
          ms: formatNumber(duration, locale),
        })}
      </p>
    </div>
  )
}

/**
 * Runs the instance being edited on a sample or pasted request, so the
 * administrator sees what its settings do before saving them. Plugins can
 * offer their own samples; the console adds its own image to them.
 */
export function RequestPluginTryPanel(props: RequestPluginTryPanelProps) {
  const { t, i18n } = useTranslation()
  const replyId = useId()
  const [mode, setMode] = useState<'sample' | 'paste'>('sample')
  const [sampleIndex, setSampleIndex] = useState(0)
  const [format, setFormat] = useState<string>(SAMPLE_FORMAT.value)
  const [pasted, setPasted] = useState(() =>
    JSON.stringify(
      requestPluginDryRunExample(SAMPLE_FORMAT.value, SAMPLE_FORMAT.model),
      null,
      2
    )
  )
  const [pastedReply, setPastedReply] = useState('')
  const [inputError, setInputError] = useState('')
  const [run, setRun] = useState<{
    body: unknown
    reply?: string
    instance: string
  }>()
  const image = useMemo(drawSampleImage, [])
  const checksReplies = Boolean(props.plugin.transform_hooks?.includes('reply'))
  const genericReply = t(
    'Yes, the soft colors and wide frame suit a phone wallpaper. I sent the full answer to alex@example.com; call +14155550123 if you would like a different crop.'
  )
  let samples = requestPluginSamplesFor(
    props.plugin.samples ?? [],
    i18n.language
  )
  if (samples.length === 0) {
    const genericSample: RequestPluginSample = {
      name: '',
      format: 'openai',
      body: {
        model: SAMPLE_FORMAT.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: t(
                  'Would this photo work as a phone wallpaper? Email the answer to alex@example.com, or call +14155550123 if anything is unclear.'
                ),
              },
              REQUEST_PLUGIN_SAMPLE_IMAGE,
            ],
          },
        ],
      },
    }
    samples = [genericSample]
  }
  const chosen = Math.min(sampleIndex, samples.length - 1)
  const sample = samples[chosen]
  const sampleBody = requestPluginSampleBody(sample.body, sample.format, image)
  const sampleReply = checksReplies ? (sample.reply ?? genericReply) : undefined
  // A sample's position is its identity: the list is fixed per language, and
  // so are the texts in it.
  const sampleNames = samples.map((item, position) => ({
    id: String(position),
    name: resolveLocalizedText(item.name, i18n.language) || t('Sample request'),
  }))
  const sampleTexts = requestPluginSampleTexts(sampleBody).map(
    (text, position) => ({ id: String(position), text })
  )
  // Only the console's own drawing shows as the sample's image.
  const sampleImage =
    image && requestPluginSampleHasImage(sample.body) ? image : null
  const mutation = useMutation({
    mutationFn: dryRunRequestPlugins,
    meta: { errorToast: false },
  })
  const instanceKey = props.instance ? JSON.stringify(props.instance) : ''
  const stale = Boolean(mutation.data && run && run.instance !== instanceKey)

  const chooseSample = (index: number) => {
    setSampleIndex(index)
    // The result of another sample would read as this one's.
    mutation.reset()
    setRun(undefined)
  }

  const start = () => {
    if (!props.instance) return
    let body: unknown = sampleBody
    let runFormat: string = sample.format
    let reply = sampleReply
    if (mode === 'paste') {
      try {
        body = JSON.parse(pasted)
      } catch {
        body = null
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        setInputError('Request body must be a JSON object.')
        return
      }
      runFormat = format
      reply = checksReplies && pastedReply.trim() ? pastedReply : undefined
    }
    setInputError('')
    const bodyModel = (body as { model?: unknown }).model
    const model =
      typeof bodyModel === 'string' && bodyModel.trim()
        ? bodyModel
        : (REQUEST_PLUGIN_DRY_RUN_FORMATS.find(
            (item) => item.value === runFormat
          )?.model ?? SAMPLE_FORMAT.model)
    setRun({ body, reply, instance: instanceKey })
    mutation.mutate({
      format: runFormat,
      path: requestPluginDryRunPath(runFormat, model),
      model,
      body,
      instance: props.instance,
      reply,
    })
  }

  return (
    <aside
      aria-label={t('Try it')}
      className='bg-muted/50 h-fit space-y-3 rounded-2xl p-4'
    >
      <div className='flex items-center justify-between gap-2'>
        <h3 className='flex items-center gap-1.5 text-sm font-semibold'>
          <Sparkles aria-hidden='true' className='text-primary size-4' />
          {t('Try it')}
        </h3>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='bg-background'
          disabled={!props.instance || mutation.isPending}
          onClick={start}
        >
          {mutation.isPending ? (
            <Spinner aria-hidden='true' />
          ) : (
            <Play aria-hidden='true' />
          )}
          {t('Run')}
        </Button>
      </div>
      <Tabs
        value={mode}
        onValueChange={(value) =>
          setMode(value === 'paste' ? 'paste' : 'sample')
        }
      >
        <TabsList className='w-full'>
          <TabsTrigger value='sample'>{t('Sample request')}</TabsTrigger>
          <TabsTrigger value='paste'>{t('Paste a request')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'paste' ? (
        <div className='space-y-2'>
          <Select
            value={format}
            items={REQUEST_PLUGIN_DRY_RUN_FORMATS.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            onValueChange={(value) => value && setFormat(value)}
          >
            <SelectTrigger
              className='bg-background w-full'
              aria-label={t('Request format')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_PLUGIN_DRY_RUN_FORMATS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <JsonCodeEditor
            ariaLabel={t('Request body')}
            value={pasted}
            onChange={setPasted}
            heightClassName='h-48 min-h-48 max-h-48'
          />
          {inputError && <FieldError>{t(inputError)}</FieldError>}
          {checksReplies && (
            <Field className='gap-1.5'>
              <FieldLabel
                htmlFor={replyId}
                className='text-muted-foreground text-xs font-normal'
              >
                {t('Reply to check (optional)')}
              </FieldLabel>
              <Textarea
                id={replyId}
                value={pastedReply}
                placeholder={genericReply}
                className='bg-background min-h-20 text-sm'
                onChange={(event) => setPastedReply(event.target.value)}
              />
            </Field>
          )}
        </div>
      ) : (
        <div className='space-y-2'>
          {samples.length > 1 && (
            <ToggleGroup
              aria-label={t('Samples')}
              value={[String(chosen)]}
              onValueChange={(value) => {
                const next = value.find((item) => item !== String(chosen))
                if (next !== undefined) chooseSample(Number(next))
              }}
              variant='outline'
              spacing={2}
              className='flex w-full flex-wrap gap-2'
            >
              {sampleNames.map((item) => (
                <ToggleGroupItem
                  key={item.id}
                  value={item.id}
                  size='sm'
                  className='bg-background data-pressed:border-primary/40 data-pressed:bg-primary/10 data-pressed:text-primary rounded-full px-3'
                >
                  {item.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          {!mutation.data && (
            <div className='bg-background space-y-3 rounded-xl border p-3'>
              {sampleTexts.map((item) => (
                <p
                  key={item.id}
                  className='line-clamp-6 text-sm leading-6 break-words whitespace-pre-wrap'
                >
                  {item.text}
                </p>
              ))}
              {sampleImage && (
                <ImageFacts
                  label={t('Attached image')}
                  src={sampleImage}
                  mime='image/png'
                  bytes={dataUrlBytes(sampleImage)}
                />
              )}
              {sampleReply !== undefined && (
                <div className='space-y-1 border-t pt-3'>
                  <p className='text-muted-foreground text-xs'>
                    {t('Sample reply')}
                  </p>
                  <p className='line-clamp-6 text-sm leading-6 break-words whitespace-pre-wrap'>
                    {sampleReply}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {!props.instance && (
        <p className='text-muted-foreground text-xs'>
          {t('Fix the settings first, then run.')}
        </p>
      )}
      {mutation.isError && (
        <FieldError className='whitespace-pre-wrap'>
          {getServerErrorMessage(mutation.error)}
        </FieldError>
      )}
      {stale && (
        <p className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <span
            aria-hidden='true'
            className='bg-warning size-1.5 rounded-full'
          />
          {t('The settings changed since this run.')}
        </p>
      )}
      {mutation.data && run && (
        <TryResult
          plugin={props.plugin}
          sent={run.body}
          sentReply={run.reply}
          result={mutation.data}
        />
      )}
      {!mutation.data && (
        <p className='text-muted-foreground text-[11px]'>
          {t('Uses the current settings.')}
        </p>
      )}
    </aside>
  )
}
