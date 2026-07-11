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
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Music,
  Video,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { Label } from '@/components/ui/label'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { formatLogQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { TASK_ACTIONS, TASK_PLATFORMS, TASK_STATUS } from '../../constants'
import { formatDuration } from '../../lib/format'
import {
  getTaskPlatformName,
  taskActionMapper,
  taskStatusMapper,
} from '../../lib/mappers'
import type { TaskLog } from '../../types'
import { AudioClipCard, type AudioClip } from './audio-preview-dialog'

const VIDEO_ACTIONS = new Set<string>([
  TASK_ACTIONS.GENERATE,
  TASK_ACTIONS.TEXT_GENERATE,
  TASK_ACTIONS.FIRST_TAIL_GENERATE,
  TASK_ACTIONS.REFERENCE_GENERATE,
  TASK_ACTIONS.REMIX_GENERATE,
])

const MAX_VALUE_LENGTH = 800

function parseJson(raw: unknown): unknown {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// snake_case / camelCase -> "Title Case" with common acronym fixes, so any
// upstream provider payload renders with readable labels.
function humanizeKey(key: string): string {
  const spaced = key
    .replaceAll('_', ' ')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  return spaced
    .replaceAll(/\b\w/g, (c) => c.toUpperCase())
    .replaceAll(/\bUrl\b/g, 'URL')
    .replaceAll(/\bId\b/g, 'ID')
    .replaceAll(/\bApi\b/g, 'API')
    .replaceAll(/\bFps\b/g, 'FPS')
}

function formatScalar(value: unknown): string {
  if (value == null) return '-'
  const str = typeof value === 'string' ? value : String(value)
  if (str.length > MAX_VALUE_LENGTH) return `${str.slice(0, MAX_VALUE_LENGTH)}…`
  return str
}

interface FlatEntry {
  label: string
  value: string
  mono?: boolean
}

// Flatten a nested upstream payload into readable rows. Nested objects are
// prefixed with their parent label ("Cost › Currency"); arrays of scalars are
// joined, arrays of objects are shown as compact JSON.
function flattenEntries(
  obj: Record<string, unknown>,
  parent = ''
): FlatEntry[] {
  const entries: FlatEntry[] = []
  for (const [key, value] of Object.entries(obj)) {
    const label = parent ? `${parent} › ${humanizeKey(key)}` : humanizeKey(key)
    if (isPlainObject(value)) {
      entries.push(...flattenEntries(value, label))
    } else if (Array.isArray(value)) {
      const allScalar = value.every((v) => v == null || typeof v !== 'object')
      if (allScalar) {
        entries.push({
          label,
          value: value.map(formatScalar).join(', ') || '-',
        })
      } else {
        entries.push({
          label,
          value: formatScalar(JSON.stringify(value)),
          mono: true,
        })
      }
    } else {
      entries.push({
        label,
        value: formatScalar(value),
        mono: typeof value !== 'boolean',
      })
    }
  }
  return entries
}

// The DTO's result_url falls back to fail_reason when no dedicated URL is
// stored, so only treat http(s) links or the internal video proxy path as a
// playable URL.
function resolveVideoUrl(log: TaskLog): string {
  const raw = (log.result_url ?? '').trim()
  const isHttp = /^https?:\/\//i.test(raw)
  const isProxy = raw.startsWith('/v1/videos/')
  if (isHttp || isProxy) return raw
  if (VIDEO_ACTIONS.has(log.action) && log.status === TASK_STATUS.SUCCESS) {
    if (log.task_id) return `/v1/videos/${log.task_id}/content`
  }
  return ''
}

function DetailRow(props: {
  label: React.ReactNode
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className='grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-2 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3'>
      <span className='text-muted-foreground min-w-0 text-xs'>
        {props.label}
      </span>
      <span
        className={cn(
          'max-w-full min-w-0 text-xs break-all sm:wrap-break-word',
          props.mono && 'font-mono'
        )}
      >
        {props.value}
      </span>
    </div>
  )
}

function DetailSection(props: {
  icon?: React.ReactNode
  label: string
  variant?: 'default' | 'destructive'
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const isDestructive = props.variant === 'destructive'
  return (
    <div className='min-w-0 space-y-1.5'>
      <div className='flex items-center justify-between gap-2'>
        <Label
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold',
            isDestructive && 'text-destructive'
          )}
        >
          {props.icon}
          {props.label}
        </Label>
        {props.action}
      </div>
      <div
        className={cn(
          'min-w-0 space-y-1 overflow-hidden rounded-md border p-2.5 max-sm:p-2',
          isDestructive
            ? 'border-destructive/25 bg-destructive/10'
            : 'bg-muted/30'
        )}
      >
        {props.children}
      </div>
    </div>
  )
}

function CopyButton(props: {
  text: string
  copied: boolean
  onCopy: () => void
}) {
  const { t } = useTranslation()
  return (
    <Button
      variant='ghost'
      size='icon-xs'
      onClick={props.onCopy}
      title={t('Copy to clipboard')}
      aria-label={t('Copy to clipboard')}
    >
      {props.copied ? (
        <Check className='text-success size-3' />
      ) : (
        <Copy className='size-3' />
      )}
    </Button>
  )
}

function VideoPreview({ url }: { url: string }) {
  const { t } = useTranslation()
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-muted-foreground text-xs'>
          {t('Failed to load video')}
        </span>
        <Button
          variant='outline'
          size='sm'
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className='size-3' />
          {t('Open in new tab')}
        </Button>
      </div>
    )
  }

  return (
    <video
      src={url}
      controls
      preload='metadata'
      onError={() => setHasError(true)}
      className='bg-background max-h-[420px] w-full rounded-md border'
    />
  )
}

function AudioPreview({ clips }: { clips: AudioClip[] }) {
  return (
    <div className='space-y-3'>
      {clips.map((clip, idx) => (
        <AudioClipCard key={clip.clip_id || clip.id || idx} clip={clip} />
      ))}
    </div>
  )
}

interface TaskDetailsDialogProps {
  log: TaskLog
  isAdmin: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDetailsDialog(props: TaskDetailsDialogProps) {
  const { t } = useTranslation()
  const { log, isAdmin } = props
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })

  const platformName = getTaskPlatformName(log.platform)
  const duration = formatDuration(log.submit_time, log.finish_time, 'seconds')
  const videoUrl = resolveVideoUrl(log)
  const resultUrl = (log.result_url ?? '').trim()
  const isResultLink =
    /^https?:\/\//i.test(resultUrl) || resultUrl.startsWith('/v1/videos/')

  const parsedData = useMemo(() => parseJson(log.data), [log.data])
  const props_ = useMemo(() => {
    if (isPlainObject(log.properties)) return log.properties
    const parsed = parseJson(log.properties)
    return isPlainObject(parsed) ? parsed : null
  }, [log.properties])

  const asString = (v: unknown): string | undefined =>
    typeof v === 'string' && v !== '' ? v : undefined
  const originModel = asString(props_?.origin_model_name)
  const upstreamModel = asString(props_?.upstream_model_name)
  const dataModel = isPlainObject(parsedData)
    ? asString(parsedData.model)
    : undefined
  const model = originModel || upstreamModel || dataModel

  const audioClips = useMemo(() => {
    if (log.platform !== TASK_PLATFORMS.SUNO) return []
    if (log.status !== TASK_STATUS.SUCCESS) return []
    if (!Array.isArray(parsedData)) return []
    return parsedData.filter(
      (c) =>
        c && typeof c === 'object' && (c as Record<string, unknown>).audio_url
    ) as AudioClip[]
  }, [log.platform, log.status, parsedData])

  const upstreamEntries = useMemo(
    () => (isPlainObject(parsedData) ? flattenEntries(parsedData) : []),
    [parsedData]
  )
  const upstreamRaw = useMemo(() => {
    if (isPlainObject(parsedData) || parsedData == null) return ''
    try {
      return JSON.stringify(parsedData, null, 2)
    } catch {
      return String(parsedData)
    }
  }, [parsedData])

  const rawJson = useMemo(() => {
    try {
      return JSON.stringify(log, null, 2)
    } catch {
      return ''
    }
  }, [log])

  const hasFailReason = !!log.fail_reason && log.fail_reason.trim() !== ''

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        <>
          {t('Task Details')}
          <StatusBadge
            variant={taskStatusMapper.getVariant(log.status)}
            size='sm'
          >
            {t(
              taskStatusMapper.getLabel(log.status, log.status || 'Submitting')
            )}
          </StatusBadge>
        </>
      }
      description={t('View the complete details for this task')}
      contentClassName='min-w-0 overflow-hidden max-sm:max-h-[calc(100dvh-1.5rem)] max-sm:w-[calc(100vw-1.5rem)] max-sm:max-w-[calc(100vw-1.5rem)] max-sm:p-4 sm:max-w-lg'
      headerClassName='max-sm:gap-1'
      titleClassName='flex items-center gap-2 text-base'
      descriptionClassName='sr-only'
      contentHeight='min(78dvh, 760px)'
      bodyClassName='pr-2 sm:pr-4'
    >
      <div className='w-full max-w-full min-w-0 space-y-3 overflow-x-hidden py-1'>
        {/* Overview */}
        <DetailSection label={t('Overview')}>
          {log.task_id && (
            <DetailRow
              label={t('Task ID')}
              value={
                <span className='flex items-start gap-1'>
                  <span className='min-w-0 break-all'>{log.task_id}</span>
                  <button
                    type='button'
                    className='text-muted-foreground hover:text-foreground mt-0.5 shrink-0'
                    onClick={() => copyToClipboard(log.task_id)}
                    title={t('Copy to clipboard')}
                    aria-label={t('Copy to clipboard')}
                  >
                    {copiedText === log.task_id ? (
                      <Check className='text-success size-3' />
                    ) : (
                      <Copy className='size-3' />
                    )}
                  </button>
                </span>
              }
              mono
            />
          )}
          {log.id > 0 && (
            <DetailRow label={t('Internal ID')} value={String(log.id)} mono />
          )}
          <DetailRow label={t('Platform')} value={platformName} />
          <DetailRow
            label={t('Action')}
            value={t(taskActionMapper.getLabel(log.action, log.action))}
          />
          <DetailRow
            label={t('Status')}
            value={
              <StatusBadge
                variant={taskStatusMapper.getVariant(log.status)}
                size='sm'
              >
                {t(
                  taskStatusMapper.getLabel(
                    log.status,
                    log.status || 'Submitting'
                  )
                )}
              </StatusBadge>
            }
          />
          {log.progress && (
            <DetailRow
              label={t('Progress')}
              value={
                <StatusBadge variant='neutral' size='sm' className='font-mono'>
                  {log.progress}
                </StatusBadge>
              }
            />
          )}
          {model && <DetailRow label={t('Model')} value={model} mono />}
        </DetailSection>

        {/* Timing */}
        <DetailSection label={t('Timing')}>
          {log.created_at ? (
            <DetailRow
              label={t('Created At')}
              value={formatTimestampToDate(log.created_at, 'seconds')}
              mono
            />
          ) : null}
          {log.updated_at ? (
            <DetailRow
              label={t('Updated At')}
              value={formatTimestampToDate(log.updated_at, 'seconds')}
              mono
            />
          ) : null}
          <DetailRow
            label={t('Submit Time')}
            value={formatTimestampToDate(log.submit_time, 'seconds')}
            mono
          />
          {log.start_time ? (
            <DetailRow
              label={t('Start Time')}
              value={formatTimestampToDate(log.start_time, 'seconds')}
              mono
            />
          ) : null}
          {log.finish_time ? (
            <DetailRow
              label={t('Finish Time')}
              value={formatTimestampToDate(log.finish_time, 'seconds')}
              mono
            />
          ) : null}
          {duration && (
            <DetailRow
              label={t('Duration')}
              value={
                <StatusBadge
                  variant={duration.variant}
                  size='sm'
                  className='tabular-nums'
                >
                  {duration.durationSec.toFixed(1)}s
                </StatusBadge>
              }
            />
          )}
        </DetailSection>

        {/* Billing */}
        <DetailSection label={t('Billing')}>
          {typeof log.quota === 'number' && (
            <DetailRow
              label={t('Cost')}
              value={formatLogQuota(log.quota)}
              mono
            />
          )}
          {log.group && <DetailRow label={t('Group')} value={log.group} mono />}
          {isAdmin && log.channel_id > 0 && (
            <DetailRow label={t('Channel')} value={`#${log.channel_id}`} mono />
          )}
          {isAdmin && log.username && (
            <DetailRow label={t('User')} value={log.username} />
          )}
          {isAdmin && log.user_id > 0 && (
            <DetailRow label={t('User ID')} value={String(log.user_id)} mono />
          )}
        </DetailSection>

        {/* Request properties */}
        {(originModel || upstreamModel) && (
          <DetailSection label={t('Request Properties')}>
            {originModel && (
              <DetailRow
                label={t('Original Model Name')}
                value={originModel}
                mono
              />
            )}
            {upstreamModel && (
              <DetailRow
                label={t('Upstream Model Name')}
                value={upstreamModel}
                mono
              />
            )}
          </DetailSection>
        )}

        {/* Fail reason */}
        {hasFailReason && (
          <DetailSection
            icon={<AlertTriangle className='size-3.5' aria-hidden='true' />}
            label={t('Fail Reason')}
            variant='destructive'
            action={
              <CopyButton
                text={log.fail_reason ?? ''}
                copied={copiedText === log.fail_reason}
                onCopy={() => copyToClipboard(log.fail_reason ?? '')}
              />
            }
          >
            <p className='text-destructive text-xs leading-relaxed break-all whitespace-pre-wrap sm:wrap-break-word'>
              {log.fail_reason}
            </p>
          </DetailSection>
        )}

        {/* Result */}
        {(videoUrl || isResultLink || audioClips.length > 0) && (
          <DetailSection
            icon={<Video className='size-3.5' aria-hidden='true' />}
            label={t('Result')}
            action={
              isResultLink ? (
                <div className='flex items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='icon-xs'
                    onClick={() =>
                      window.open(resultUrl, '_blank', 'noopener,noreferrer')
                    }
                    title={t('Open in new tab')}
                    aria-label={t('Open in new tab')}
                  >
                    <ExternalLink className='size-3' />
                  </Button>
                  <CopyButton
                    text={resultUrl}
                    copied={copiedText === resultUrl}
                    onCopy={() => copyToClipboard(resultUrl)}
                  />
                </div>
              ) : undefined
            }
          >
            {isResultLink && (
              <DetailRow label={t('Result URL')} value={resultUrl} mono />
            )}
            {videoUrl && <VideoPreview url={videoUrl} />}
            {audioClips.length > 0 && (
              <div className='flex items-center gap-1.5 pt-1'>
                <Music
                  className='text-muted-foreground size-3.5'
                  aria-hidden='true'
                />
                <span className='text-xs font-medium'>
                  {t('Audio Preview')}
                </span>
              </div>
            )}
            {audioClips.length > 0 && <AudioPreview clips={audioClips} />}
          </DetailSection>
        )}

        {/* Upstream response (parsed task data) */}
        {(upstreamEntries.length > 0 || upstreamRaw) && (
          <DetailSection label={t('Upstream Response')}>
            {upstreamEntries.length > 0 ? (
              upstreamEntries.map((entry) => (
                <DetailRow
                  key={entry.label}
                  label={entry.label}
                  value={entry.value}
                  mono={entry.mono}
                />
              ))
            ) : (
              <pre className='bg-background/60 max-h-64 min-w-0 overflow-auto rounded border p-2 font-mono text-xs leading-relaxed whitespace-pre'>
                {upstreamRaw}
              </pre>
            )}
          </DetailSection>
        )}

        {/* Raw JSON */}
        {rawJson && (
          <DetailSection
            label={t('Raw Data')}
            action={
              <CopyButton
                text={rawJson}
                copied={copiedText === rawJson}
                onCopy={() => copyToClipboard(rawJson)}
              />
            }
          >
            <pre className='bg-background/60 max-h-72 min-w-0 overflow-auto rounded border p-2 font-mono text-xs leading-relaxed whitespace-pre'>
              {rawJson}
            </pre>
          </DetailSection>
        )}
      </div>
    </Dialog>
  )
}
