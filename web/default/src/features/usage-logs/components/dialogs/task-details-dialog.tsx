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
import { Check, Copy, ExternalLink, Info, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { formatLogQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { TASK_STATUS } from '../../constants'
import { taskActionMapper, taskStatusMapper } from '../../lib/mappers'
import {
  extractTaskUpstreamScalars,
  formatTaskDurationSec,
  formatTaskJson,
  getTaskModelName,
  getTaskVideoResultUrl,
  isTaskVideoAction,
  parseTaskDataArray,
  parseTaskDataValue,
  parseTaskProperties,
  resolveTaskPlatformLabel,
} from '../../lib/task-log-utils'
import type { TaskLog } from '../../types'
import { VideoPreviewDialog } from './video-preview-dialog'

function DetailRow(props: {
  label: string
  value: React.ReactNode
  mono?: boolean
  muted?: boolean
}) {
  return (
    <div className='grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] gap-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3'>
      <span className='text-muted-foreground min-w-0 text-xs'>
        {props.label}
      </span>
      <span
        className={cn(
          'max-w-full min-w-0 text-xs break-all sm:wrap-break-word',
          props.mono && 'font-mono',
          props.muted && 'text-muted-foreground'
        )}
      >
        {props.value ?? '-'}
      </span>
    </div>
  )
}

function DetailSection(props: {
  label: string
  children: React.ReactNode
  variant?: 'default' | 'danger'
}) {
  const isDanger = props.variant === 'danger'
  return (
    <div className='min-w-0 space-y-1.5'>
      <Label
        className={cn(
          'flex items-center gap-1.5 text-xs font-semibold',
          isDanger && 'text-red-500'
        )}
      >
        {props.label}
      </Label>
      <div className='bg-muted/20 space-y-2 rounded-md border px-3 py-2.5'>
        {props.children}
      </div>
    </div>
  )
}

function CopyableValue({ value }: { value: string }) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })

  if (!value) return <>-</>

  return (
    <div className='flex min-w-0 items-start gap-1.5'>
      <span className='min-w-0 flex-1 font-mono break-all'>{value}</span>
      <Button
        variant='ghost'
        size='sm'
        className='h-6 w-6 shrink-0 p-0'
        onClick={() => copyToClipboard(value)}
        title={t('Copy to clipboard')}
      >
        {copiedText === value ? (
          <Check className='size-3.5 text-green-600' />
        ) : (
          <Copy className='size-3.5' />
        )}
      </Button>
    </div>
  )
}

function formatTimestamp(value?: number) {
  if (!value) return '-'
  return formatTimestampToDate(value, 'seconds')
}

interface TaskDetailsDialogProps {
  log: TaskLog
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin?: boolean
}

export function TaskDetailsDialog(props: TaskDetailsDialogProps) {
  const { t } = useTranslation()
  const [videoOpen, setVideoOpen] = useState(false)
  const { log, isAdmin = false } = props

  const properties = useMemo(
    () => parseTaskProperties(log.properties),
    [log.properties]
  )
  const parsedData = useMemo(() => parseTaskDataValue(log.data), [log.data])
  const upstreamScalars = useMemo(
    () => extractTaskUpstreamScalars(parsedData),
    [parsedData]
  )
  const sunoClips = useMemo(() => parseTaskDataArray(log.data), [log.data])
  const modelName = useMemo(() => getTaskModelName(log), [log])
  const videoResultUrl = useMemo(
    () => getTaskVideoResultUrl(log, log.fail_reason),
    [log]
  )
  const rawJson = useMemo(() => formatTaskJson(log), [log])
  const duration = formatTaskDurationSec(log.submit_time, log.finish_time)

  const showVideoPreview =
    log.status === TASK_STATUS.SUCCESS &&
    isTaskVideoAction(log.action) &&
    !!videoResultUrl

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={
          <>
            <Info className='h-5 w-5' />
            {t('Task Log Details')}
          </>
        }
        description={t('View the complete details for this task log entry')}
        contentClassName='sm:max-w-2xl'
        titleClassName='flex items-center gap-2'
        contentHeight='auto'
        bodyClassName='space-y-4'
      >
        <ScrollArea className='max-h-[75vh] pr-3'>
          <div className='space-y-4 pb-1'>
            <DetailSection label={t('Overview')}>
              <DetailRow
                label={t('Task ID')}
                value={<CopyableValue value={log.task_id} />}
                mono
              />
              <DetailRow
                label={t('Internal ID')}
                value={log.id ? String(log.id) : '-'}
                mono
              />
              <DetailRow
                label={t('Platform')}
                value={resolveTaskPlatformLabel(log.platform, t)}
              />
              <DetailRow
                label={t('Action')}
                value={t(taskActionMapper.getLabel(log.action))}
              />
              <DetailRow
                label={t('Status')}
                value={
                  <StatusBadge
                    label={t(
                      taskStatusMapper.getLabel(
                        log.status,
                        log.status || 'Submitting'
                      )
                    )}
                    variant={taskStatusMapper.getVariant(log.status)}
                    size='sm'
                    copyable={false}
                    className='-ml-1.5'
                  />
                }
              />
              <DetailRow label={t('Progress')} value={log.progress || '-'} />
              {modelName ? (
                <DetailRow label={t('Model')} value={modelName} mono />
              ) : null}
            </DetailSection>

            <DetailSection label={t('Timing')}>
              <DetailRow
                label={t('Created At')}
                value={formatTimestamp(log.created_at)}
                mono
              />
              <DetailRow
                label={t('Updated At')}
                value={formatTimestamp(log.updated_at)}
                mono
              />
              <DetailRow
                label={t('Submit Time')}
                value={formatTimestamp(log.submit_time)}
                mono
              />
              <DetailRow
                label={t('Start Time')}
                value={formatTimestamp(log.start_time)}
                mono
              />
              <DetailRow
                label={t('Finish Time')}
                value={formatTimestamp(log.finish_time)}
                mono
              />
              <DetailRow label={t('Duration')} value={duration || '-'} mono />
            </DetailSection>

            <DetailSection label={t('Billing')}>
              <DetailRow
                label={t('Cost')}
                value={log.quota ? formatLogQuota(log.quota) : '-'}
              />
              <DetailRow label={t('Group')} value={log.group || '-'} />
              {isAdmin ? (
                <>
                  <DetailRow
                    label={t('Channel')}
                    value={log.channel_id ? `#${log.channel_id}` : '-'}
                    mono
                  />
                  <DetailRow
                    label={t('User')}
                    value={
                      log.username || (log.user_id ? String(log.user_id) : '-')
                    }
                  />
                  <DetailRow
                    label={t('User ID')}
                    value={log.user_id ? String(log.user_id) : '-'}
                    mono
                  />
                </>
              ) : null}
            </DetailSection>

            {(properties.input ||
              properties.origin_model_name ||
              properties.upstream_model_name) && (
              <DetailSection label={t('Request Properties')}>
                {properties.origin_model_name ? (
                  <DetailRow
                    label={t('Origin Model Name')}
                    value={properties.origin_model_name}
                    mono
                  />
                ) : null}
                {properties.upstream_model_name ? (
                  <DetailRow
                    label={t('Upstream Model Name')}
                    value={properties.upstream_model_name}
                    mono
                  />
                ) : null}
                {properties.input ? (
                  <div className='space-y-1'>
                    <span className='text-muted-foreground text-xs'>
                      {t('Input Prompt')}
                    </span>
                    <p className='text-xs leading-relaxed break-all whitespace-pre-wrap'>
                      {properties.input}
                    </p>
                  </div>
                ) : null}
              </DetailSection>
            )}

            {(videoResultUrl || log.fail_reason) && (
              <DetailSection
                label={t('Result')}
                variant={
                  log.status === TASK_STATUS.FAILURE ? 'danger' : 'default'
                }
              >
                {videoResultUrl ? (
                  <div className='space-y-2'>
                    <DetailRow
                      label={t('Result URL')}
                      value={<CopyableValue value={videoResultUrl} />}
                    />
                    {showVideoPreview ? (
                      <Button
                        variant='outline'
                        size='sm'
                        className='gap-1.5'
                        onClick={() => setVideoOpen(true)}
                      >
                        <Video className='size-3.5' />
                        {t('Click to preview video')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {log.fail_reason && !log.fail_reason.startsWith('http') ? (
                  <div className='space-y-1'>
                    <span className='text-xs font-medium text-red-600 dark:text-red-400'>
                      {t('Fail Reason')}
                    </span>
                    <p className='text-xs leading-relaxed break-all whitespace-pre-wrap text-red-600 dark:text-red-400'>
                      {log.fail_reason}
                    </p>
                  </div>
                ) : null}
              </DetailSection>
            )}

            {log.platform === 'suno' && sunoClips.length > 0 && (
              <DetailSection label={t('Audio Clips')}>
                <div className='space-y-2'>
                  {sunoClips.map((clip, index) => {
                    if (!clip || typeof clip !== 'object') return null
                    const item = clip as Record<string, unknown>
                    const audioUrl =
                      typeof item.audio_url === 'string' ? item.audio_url : ''
                    const title =
                      typeof item.title === 'string'
                        ? item.title
                        : `#${index + 1}`
                    return (
                      <div
                        key={String(item.clip_id || item.id || index)}
                        className='space-y-1 rounded-md border px-2.5 py-2'
                      >
                        <div className='text-xs font-medium'>{title}</div>
                        {audioUrl ? (
                          <>
                            <audio
                              src={audioUrl}
                              controls
                              preload='none'
                              className='h-9 w-full'
                            />
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-7 gap-1 px-0 text-xs'
                              onClick={() => window.open(audioUrl, '_blank')}
                            >
                              <ExternalLink className='size-3' />
                              {t('Open in new tab')}
                            </Button>
                          </>
                        ) : (
                          <span className='text-muted-foreground text-xs'>
                            -
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </DetailSection>
            )}

            {upstreamScalars.length > 0 && (
              <DetailSection label={t('Upstream Response')}>
                {upstreamScalars.map((row) => (
                  <DetailRow
                    key={row.label}
                    label={t(row.label)}
                    value={row.value}
                    mono={
                      row.label === 'Upstream Task ID' || row.label === 'Model'
                    }
                  />
                ))}
              </DetailSection>
            )}

            <DetailSection label={t('Raw JSON')}>
              <pre className='bg-muted/40 max-h-64 overflow-auto rounded-md p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap'>
                {rawJson || '-'}
              </pre>
            </DetailSection>
          </div>
        </ScrollArea>
      </Dialog>

      {videoResultUrl ? (
        <VideoPreviewDialog
          open={videoOpen}
          onOpenChange={setVideoOpen}
          videoUrl={videoResultUrl}
        />
      ) : null}
    </>
  )
}
