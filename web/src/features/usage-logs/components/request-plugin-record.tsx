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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PluginIcon } from '@/features/task-plugins/components/plugin-icon'
import {
  REQUEST_PLUGIN_EFFORT_LABELS,
  REQUEST_PLUGIN_STAGE_LABELS,
} from '@/features/task-plugins/lib/request-plugins'
import { toIntlLocale } from '@/i18n/languages'
import { formatBytes, formatNumber } from '@/lib/format'
import { resolveLocalizedText } from '@/lib/localized-text'
import { cn } from '@/lib/utils'

import type {
  RequestPluginAdminStep,
  RequestPluginRecordAttachment,
  RequestPluginRecordChange,
  RequestPluginRecordEntry,
  RequestPluginRecordItem,
} from '../types'
import { DetailRow } from './dialogs/log-detail-layout'

const CHANGE_OP_LABELS: Record<string, string> = {
  replace: 'Rewrite',
  add: 'Add',
  remove: 'Delete',
  move: 'Move',
  copy: 'Copy',
  test: 'Check',
}

const VALUE_TYPE_LABELS: Record<string, string> = {
  string: 'Text',
  number: 'Number',
  boolean: 'Boolean',
  array: 'List',
  object: 'Object',
  null: 'Empty',
}

const VALUE_LENGTH_LABELS: Record<string, string> = {
  string: 'Text, {{value}} characters',
  array: 'List, {{value}} items',
  object: 'Object, {{value}} fields',
}

const FINDING_CATEGORY_LABELS: Record<string, string> = {
  email: 'Email address',
  phone: 'Phone number',
  id_card: 'ID card number',
  bank_card: 'Bank card number',
  api_key: 'API key',
  ipv4: 'IP address',
  custom: 'Custom rule',
}

const IMAGE_FORMAT_NAMES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/avif': 'AVIF',
  'image/heic': 'HEIC',
  'image/bmp': 'BMP',
  'image/svg+xml': 'SVG',
}

const ATTACHMENT_KIND_LABELS: Record<string, string> = {
  image: 'Image',
  document: 'Document',
  audio: 'Audio',
  video: 'Video',
  other: 'File',
}

const ATTACHMENT_UNCHECKED_REASONS: Record<string, string> = {
  unsupported: 'No text can be read from this kind of file',
  reference: 'The file is not in the request',
  too_large: 'The file is too large',
  unreadable: 'The file could not be opened',
  limit: 'This request reached its checking limit',
  no_text: 'No text in the file',
  busy: 'Server busy',
  not_rewritable: 'Cannot be rewritten',
}

function imageFormatName(mime: string) {
  return IMAGE_FORMAT_NAMES[mime] ?? mime.replace(/^image\//, '').toUpperCase()
}

type RequestPluginRecordProps = {
  items: RequestPluginRecordItem[]
  /** Plugin icons are served to super admins only; others see the name avatar. */
  loadIcons?: boolean
}

/**
 * What request processing did to a request, in the words the log owner sees:
 * each plugin, the stage it ran at, and what it changed, found or refused.
 */
export function RequestPluginRecord(props: RequestPluginRecordProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  // The record is written once and never reordered, so its position is a
  // stable identity.
  const items = props.items.map((item, position) => ({
    item,
    id: String(position),
  }))
  return (
    <div className='space-y-2'>
      {items.map(({ item, id }) =>
        'plugin' in item ? (
          <RecordEntry key={id} entry={item} loadIcons={props.loadIcons} />
        ) : (
          <p key={id} className='text-muted-foreground text-xs'>
            {t('{{value}} more steps are not shown', {
              value: formatNumber(item.truncated, locale),
            })}
          </p>
        )
      )}
    </div>
  )
}

function RecordEntry(props: {
  entry: RequestPluginRecordEntry
  loadIcons?: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const entry = props.entry
  const name = resolveLocalizedText(entry.name, i18n.language) || entry.plugin
  const notice = resolveLocalizedText(entry.notice, i18n.language)
  const changes = (entry.changes ?? []).map((change, position) => ({
    change,
    id: String(position),
  }))
  const attachments = (entry.attachments ?? []).map((attachment, position) => ({
    attachment,
    id: String(position),
  }))
  const headersSet = entry.headers?.set ?? []
  const headersRemoved = entry.headers?.remove ?? []
  const headersOverridden = new Set(
    (entry.headers?.overridden ?? []).map((name) => name.toLowerCase())
  )
  const findings = (entry.findings ?? [])
    .map((finding) => {
      const category = FINDING_CATEGORY_LABELS[finding.category]
      return `${category ? t(category) : finding.category} × ${formatNumber(finding.count, locale)}`
    })
    .join(', ')

  return (
    <div className='bg-background/60 min-w-0 space-y-1.5 rounded border p-2'>
      <div className='flex min-w-0 flex-wrap items-center gap-1.5'>
        <PluginIcon
          plugin={{ key: entry.plugin, name, hasIcon: props.loadIcons }}
          size={16}
        />
        <span className='min-w-0 text-xs font-medium break-words'>{name}</span>
        <StatusBadge
          variant='neutral'
          label={t(REQUEST_PLUGIN_STAGE_LABELS[entry.stage] ?? entry.stage)}
          size='sm'
          copyable={false}
        />
        {entry.unchecked && (
          <StatusBadge
            variant='neutral'
            label={entry.audio ? t('Audio not checked') : t('Not checked')}
            size='sm'
            copyable={false}
          />
        )}
        {entry.rejected && (
          <StatusBadge
            variant='danger'
            label={
              entry.stage === 'reply'
                ? t('Stopped (code: {{code}})', { code: entry.rejected.code })
                : t('Blocked (code: {{code}})', { code: entry.rejected.code })
            }
            size='sm'
            copyable={false}
          />
        )}
      </div>
      {notice && <p className='text-xs break-words'>{notice}</p>}
      {changes.map(({ change, id }) => (
        <ChangeLine key={id} change={change} locale={locale} />
      ))}
      {(entry.more_changes ?? 0) > 0 && (
        <p className='text-muted-foreground text-xs'>
          {t('{{value}} more changes', {
            value: formatNumber(entry.more_changes, locale),
          })}
        </p>
      )}
      {headersSet.length > 0 && (
        <DetailRow
          label={t('Headers set')}
          value={
            <HeaderNames names={headersSet} overridden={headersOverridden} />
          }
          mono
        />
      )}
      {headersRemoved.length > 0 && (
        <DetailRow
          label={t('Headers removed')}
          value={
            <HeaderNames
              names={headersRemoved}
              overridden={headersOverridden}
            />
          }
          mono
        />
      )}
      {entry.reasoning_effort && (
        <DetailRow
          label={t('Reasoning Effort')}
          value={t(
            REQUEST_PLUGIN_EFFORT_LABELS[entry.reasoning_effort] ??
              entry.reasoning_effort
          )}
        />
      )}
      {entry.media?.map((media) => {
        const values = {
          index: media.index + 1,
          from: `${imageFormatName(media.from.mime)} ${formatBytes(media.from.bytes, locale)}`,
          to: `${imageFormatName(media.to.mime)} ${formatBytes(media.to.bytes, locale)}`,
        }
        return (
          <p key={media.index} className='text-xs'>
            {media.lossless
              ? t('Image {{index}}: {{from}} → {{to}} (lossless)', values)
              : t('Image {{index}}: {{from}} → {{to}}', values)}
          </p>
        )
      })}
      {attachments.length > 0 && (
        // The list holds every attachment or only the ones the plugin
        // read, sent or rewrote, so its items are not numbered.
        <DetailRow
          label={t('Attachments')}
          value={
            <>
              {attachments.map(({ attachment, id }) => (
                <AttachmentLine key={id} attachment={attachment} />
              ))}
              {(entry.more_attachments ?? 0) > 0 && (
                <span className='text-muted-foreground block'>
                  {t('{{value}} more attachments', {
                    value: formatNumber(entry.more_attachments, locale),
                  })}
                </span>
              )}
            </>
          }
        />
      )}
      {(entry.masked ?? 0) > 0 && (
        <DetailRow
          label={t('Masked parts')}
          value={formatNumber(entry.masked, locale)}
        />
      )}
      {findings && <DetailRow label={t('Findings')} value={findings} />}
    </div>
  )
}

/** One attachment: what kind of file it was, and how much of it was checked. */
function AttachmentLine(props: { attachment: RequestPluginRecordAttachment }) {
  const { t } = useTranslation()
  const attachment = props.attachment
  const kind = ATTACHMENT_KIND_LABELS[attachment.kind] ?? 'File'
  const reason = attachment.reason
    ? ATTACHMENT_UNCHECKED_REASONS[attachment.reason]
    : undefined
  let status: ReactNode = attachment.status
  if (attachment.status === 'checked') {
    status = <span className='text-muted-foreground'>{t('Checked')}</span>
  } else if (attachment.status === 'truncated') {
    // Colored words at the size of the line, not pills.
    status = (
      <StatusBadge
        type='text'
        variant='warning'
        label={t('Only the first part was checked')}
        className='text-xs'
        copyable={false}
      />
    )
  } else if (attachment.status === 'unchecked') {
    status = (
      <>
        <span className='font-medium'>{t('Not checked')}</span>
        {reason && <span className='text-muted-foreground'>{t(reason)}</span>}
      </>
    )
  }
  return (
    <span className='flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 break-normal'>
      <span>{t(kind)}</span>
      {status}
      {attachment.rewritten && (
        <StatusBadge
          type='text'
          variant='info'
          label={t('Content rewritten')}
          className='text-xs'
          copyable={false}
        />
      )}
    </span>
  )
}

/** Header names, with the ones the channel replaced afterwards muted. */
function HeaderNames(props: { names: string[]; overridden: Set<string> }) {
  const { t } = useTranslation()
  const kept = props.names.filter(
    (name) => !props.overridden.has(name.toLowerCase())
  )
  const replaced = props.names.filter((name) =>
    props.overridden.has(name.toLowerCase())
  )
  return (
    <>
      {kept.length > 0 && <span className='block'>{kept.join(', ')}</span>}
      {replaced.length > 0 && (
        <span className='text-muted-foreground block'>
          <span>{replaced.join(', ')}</span>
          <span className='block font-sans'>
            {t('Replaced by the channel setting')}
          </span>
        </span>
      )}
    </>
  )
}

function ChangeLine(props: {
  change: RequestPluginRecordChange
  locale?: string
}) {
  const { t } = useTranslation()
  const change = props.change
  const overridden = change.overridden === true
  const opLabel = CHANGE_OP_LABELS[change.op]
  const target = change.from ? `${change.from} → ${change.path}` : change.path
  let detail = null
  if (change.value !== undefined) {
    detail = (
      <span
        className={cn(
          'min-w-0 font-mono text-[11px] break-all',
          overridden && 'text-muted-foreground'
        )}
      >
        {JSON.stringify(change.value)}
      </span>
    )
  } else if (change.type) {
    const lengthLabel = VALUE_LENGTH_LABELS[change.type]
    const typeLabel = VALUE_TYPE_LABELS[change.type]
    let text = typeLabel ? t(typeLabel) : change.type
    if (lengthLabel && change.length !== undefined) {
      text = t(lengthLabel, {
        value: formatNumber(change.length, props.locale),
      })
    }
    detail = <span className='text-muted-foreground text-xs'>{text}</span>
  }
  return (
    <div className='flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:gap-2'>
      <StatusBadge
        variant='neutral'
        label={opLabel ? t(opLabel) : change.op}
        size='sm'
        className='shrink-0 font-medium'
        copyable={false}
      />
      <span
        className={cn(
          'min-w-0 font-mono text-[11px] leading-relaxed break-all',
          overridden && 'text-muted-foreground'
        )}
      >
        {target}
      </span>
      {detail}
      {overridden && (
        <span className='text-muted-foreground text-xs'>
          {t('Replaced by the channel setting')}
        </span>
      )}
    </div>
  )
}

/** Every request processing run, with what administrators need to trace it. */
export function RequestPluginAdminSteps(props: {
  steps: RequestPluginAdminStep[]
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const steps = props.steps.map((step, position) => ({
    step,
    id: String(position),
  }))
  return (
    <div className='space-y-2'>
      {steps.map(({ step, id }) => {
        const rules = [
          ...new Set(
            [
              step.rule,
              ...(step.findings ?? []).map((item) => item.rule),
            ].filter(Boolean)
          ),
        ]
        const error = step.error_class || step.error
        return (
          <div
            key={id}
            className='bg-background/60 min-w-0 space-y-1 rounded border p-2'
          >
            <DetailRow
              label={t('Instance')}
              value={
                step.name ? `${step.name} (${step.instance})` : step.instance
              }
            />
            <DetailRow label={t('Plugin')} value={step.plugin} mono />
            {step.version && (
              <DetailRow label={t('Version')} value={step.version} mono />
            )}
            <DetailRow
              label={t('Stage')}
              value={t(REQUEST_PLUGIN_STAGE_LABELS[step.stage] ?? step.stage)}
            />
            {step.duration_ms !== undefined && (
              <DetailRow
                label={t('Duration')}
                value={t('{{value}} ms', {
                  value: formatNumber(step.duration_ms, locale),
                })}
              />
            )}
            {error && <DetailRow label={t('Error')} value={error} mono />}
            {rules.length > 0 && (
              <DetailRow label={t('Rules')} value={rules.join(', ')} mono />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The log list mark of a request that request processing touched. */
export function RequestPluginLogMarker(props: {
  items: RequestPluginRecordItem[]
}) {
  const { t, i18n } = useTranslation()
  // Reading or checking alone did nothing to the request, and neither did a
  // plugin that could not read it.
  const names = new Set(
    props.items
      .filter(
        (item): item is RequestPluginRecordEntry =>
          'plugin' in item &&
          Boolean(
            item.changes?.length ||
            item.headers ||
            item.reasoning_effort ||
            item.media?.length ||
            item.masked ||
            item.findings?.length ||
            item.notice ||
            item.rejected ||
            item.attachments?.some((attachment) => attachment.rewritten)
          )
      )
      .map(
        (entry) =>
          resolveLocalizedText(entry.name, i18n.language) || entry.plugin
      )
  )
  if (names.size === 0) return null
  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger render={<span className='w-fit' tabIndex={0} />}>
          <StatusBadge
            label={t('Processed')}
            variant='info'
            size='sm'
            copyable={false}
          />
        </TooltipTrigger>
        <TooltipContent side='top' className='max-w-xs break-words'>
          {t('Request processing: {{names}}', {
            names: [...names].join(', '),
          })}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
