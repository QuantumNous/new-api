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
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { getSensitiveWordAudit } from '../../api'
import type { UsageLog } from '../../data/schema'
import type {
  KeywordFilterLogData,
  LogOtherData,
  SensitiveWordAuditEvent,
} from '../../types'
import { DetailRow, DetailSection } from './log-detail-layout'

function parseSensitiveAuditList(value: string | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return [value]
  }
}

export function SensitiveWordAuditSection(props: {
  auditId?: number
  log: UsageLog
  other: LogOtherData | null
  isAdmin: boolean
  open: boolean
  copiedText: string | null
  onCopy: (text: string) => void
}) {
  const { t } = useTranslation()
  const [event, setEvent] = useState<SensitiveWordAuditEvent | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setEvent(null)
    setLoadFailed(false)
    if (!props.open || !props.isAdmin || !props.auditId) return
    void getSensitiveWordAudit(props.auditId)
      .then((response) => {
        if (!cancelled) setEvent(response.data ?? null)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [props.auditId, props.isAdmin, props.open])

  if (!props.isAdmin) return null

  const filter =
    props.other?.admin_info?.keyword_filter ??
    props.other?.keyword_filter ??
    null
  const actionFilter: KeywordFilterLogData = {
    ...filter,
    whitelist_bypassed: event?.whitelist_bypassed ?? filter?.whitelist_bypassed,
    blocked: event?.blocked ?? filter?.blocked,
    observe_only: event?.observe_only ?? filter?.observe_only,
    auto_banned: event?.auto_banned ?? filter?.auto_banned,
    violation_count: event?.violation_count ?? filter?.violation_count,
  }
  const matchedWords = event
    ? parseSensitiveAuditList(event.matched_words)
    : (filter?.matched_words ?? [])
  const matchedRuleIds = event
    ? parseSensitiveAuditList(event.matched_rule_ids)
    : (filter?.rule_ids ?? []).map(String)
  const matchedRuleNames = event
    ? parseSensitiveAuditList(event.matched_rule_names)
    : (filter?.rule_names ?? [])
  const matchedSnippets = event
    ? parseSensitiveAuditList(event.matched_snippets)
    : (filter?.matched_snippets ?? [])
  let resultLabel = t('Recorded')
  if (actionFilter.blocked) {
    resultLabel = t('Blocked')
  } else if (actionFilter.whitelist_bypassed) {
    resultLabel = t('Whitelist bypassed')
  } else if (actionFilter.observe_only) {
    resultLabel = t('Observed')
  }
  const requestId =
    event?.request_id || filter?.request_id || props.log.request_id
  const group = event?.group_name || filter?.group || props.log.group
  const model = event?.model_name || filter?.model || props.log.model_name
  const promptHash = event?.prompt_hash || filter?.prompt_hash

  return (
    <>
      <DetailSection
        icon={<ShieldCheck className='size-3.5' aria-hidden='true' />}
        iconTone={actionFilter.blocked ? 'destructive' : 'info'}
        variant={actionFilter.blocked ? 'danger' : 'default'}
        label={t('Sensitive word audit')}
      >
        <DetailRow label={t('Result')} value={resultLabel} />
        <DetailRow
          label={t('Whitelist bypassed')}
          value={actionFilter.whitelist_bypassed ? t('Yes') : t('No')}
        />
        <DetailRow
          label={t('Observed')}
          value={actionFilter.observe_only ? t('Yes') : t('No')}
        />
        <DetailRow label={t('Request ID')} value={requestId || '-'} mono />
        <DetailRow label={t('Group')} value={group || '-'} mono />
        <DetailRow label={t('Model')} value={model || '-'} mono />
        {event?.username_snapshot && (
          <DetailRow
            label={t('User')}
            value={`${event.username_snapshot} (#${event.user_id ?? '-'})`}
          />
        )}
        {event?.endpoint && (
          <DetailRow label={t('Endpoint')} value={event.endpoint} mono />
        )}
        {event?.protocol && (
          <DetailRow label={t('Protocol')} value={event.protocol} mono />
        )}
        <DetailRow
          label={t('Violation Count')}
          value={String(actionFilter.violation_count ?? 0)}
          mono
        />
        <DetailRow
          label={t('Automatic Ban')}
          value={actionFilter.auto_banned ? t('Yes') : t('No')}
        />
        {(event || filter?.rule_version != null) && (
          <DetailRow
            label={t('Rule version')}
            value={String(event?.rule_version ?? filter?.rule_version ?? '-')}
            mono
          />
        )}
        {loadFailed && (
          <DetailRow
            label={t('Evidence')}
            value={t('Unable to load evidence')}
          />
        )}
        {!event && !loadFailed && props.auditId && (
          <DetailRow label={t('Evidence')} value={t('Loading...')} />
        )}
      </DetailSection>

      <DetailSection label={t('Rules')}>
        <DetailRow
          label={t('Rule IDs')}
          value={matchedRuleIds.length > 0 ? matchedRuleIds.join(', ') : '-'}
          mono
        />
        <DetailRow
          label={t('Rules')}
          value={
            matchedRuleNames.length > 0 ? matchedRuleNames.join(', ') : '-'
          }
        />
        <DetailRow
          label={t('Matched')}
          value={matchedWords.length > 0 ? matchedWords.join(', ') : '-'}
        />
        {matchedSnippets.length > 0 && (
          <div className='space-y-1'>
            <Label className='text-xs font-semibold'>
              {t('Matched snippets')}
            </Label>
            <pre className='bg-background/60 max-h-32 overflow-y-auto rounded border p-2 text-xs leading-relaxed whitespace-pre-wrap'>
              {matchedSnippets.join('\n')}
            </pre>
          </div>
        )}
      </DetailSection>

      <DetailSection label={t('Evidence')}>
        <DetailRow label={t('Prompt hash')} value={promptHash || '-'} mono />
        {event?.redacted_preview && (
          <div className='space-y-1'>
            <Label className='text-xs font-semibold'>
              {t('Redacted preview')}
            </Label>
            <pre className='bg-background/60 max-h-32 overflow-y-auto rounded border p-2 text-xs leading-relaxed whitespace-pre-wrap'>
              {event.redacted_preview}
            </pre>
          </div>
        )}
        <div className='bg-background/60 relative min-w-0 rounded-md border p-2'>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  className='absolute top-1 right-1'
                  onClick={() => props.onCopy(event?.full_prompt || '')}
                  disabled={!event?.full_prompt}
                  aria-label={t('Copy to clipboard')}
                />
              }
            >
              {props.copiedText === event?.full_prompt ? (
                <Check className='size-3 text-green-600' />
              ) : (
                <Copy className='size-3' />
              )}
            </TooltipTrigger>
            <TooltipContent>{t('Copy to clipboard')}</TooltipContent>
          </Tooltip>
          <Label className='mb-1 block text-xs font-semibold'>
            {t('Full prompt')}
          </Label>
          <pre className='max-h-72 overflow-y-auto pr-6 font-mono text-xs leading-relaxed whitespace-pre-wrap'>
            {event?.full_prompt || t('Not retained or expired')}
          </pre>
        </div>
      </DetailSection>
    </>
  )
}
