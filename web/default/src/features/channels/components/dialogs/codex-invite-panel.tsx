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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Gift, Mail, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { getCodexInviteStatus, type CodexInviteStatusResponse } from '../../api'
import { useCodexInviteSender } from '../../hooks/use-codex-invite-sender'
import { getCodexInviteRecipientBatchKey } from '../../lib/codex-invite-recipient-batch'
import { canSendCodexInvite } from '../../lib/codex-invite-send-guard'
import { isCurrentCodexInviteStatusRequest } from '../../lib/codex-invite-status-guard'
import { getCodexInviteStatusFailureMessage } from '../../lib/codex-invite-status-message'
import {
  maxCodexInviteEmails,
  parseCodexInviteEmails,
} from '../../lib/parse-codex-invite-emails'

type CodexInvitePanelProps = {
  open: boolean
  channelId: number
}

type ChannelScopedStatus = {
  channelId: number
  value: CodexInviteStatusResponse
}

type ChannelScopedString = {
  channelId: number
  value: string
}

type ChannelScopedConsent = {
  channelId: number
  batchKey: string
  value: boolean
}

function stringifyRule(item: unknown): string {
  if (typeof item === 'string') return item.trim()
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>
    return String(
      record.text ?? record.description ?? record.message ?? record.title ?? ''
    ).trim()
  }
  return ''
}

function extractRules(status: CodexInviteStatusResponse | null): string[] {
  const raw = status?.data?.eligibility_rules
  if (Array.isArray(raw)) {
    return raw.map(stringifyRule).filter(Boolean)
  }
  if (raw && typeof raw === 'object') {
    const rules = (raw as { rules?: unknown }).rules
    if (Array.isArray(rules)) {
      return rules.map(stringifyRule).filter(Boolean)
    }
  }
  return []
}

function extractStatusErrors(status: CodexInviteStatusResponse | null): string {
  const errors = status?.data?.status_errors
  if (!errors || typeof errors !== 'object') return ''
  return Object.values(errors)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join('; ')
}

function shouldRequireConsent(
  status: CodexInviteStatusResponse | null
): boolean {
  const eligibility = status?.data?.invite_eligibility
  if (
    eligibility &&
    Object.prototype.hasOwnProperty.call(
      eligibility,
      'requires_explicit_confirmation'
    )
  ) {
    return eligibility.requires_explicit_confirmation === true
  }
  return false
}

export function CodexInvitePanel(props: CodexInvitePanelProps) {
  const { t } = useTranslation()
  const [statusState, setStatusState] = useState<ChannelScopedStatus | null>(
    null
  )
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [consentState, setConsentState] = useState<ChannelScopedConsent | null>(
    null
  )
  const [errorState, setErrorState] = useState<ChannelScopedString | null>(null)
  const { isSending, send } = useCodexInviteSender()
  const latestPanelStateRef = useRef({
    open: props.open,
    channelId: props.channelId,
  })
  const statusRequestIdRef = useRef(0)

  const status =
    statusState?.channelId === props.channelId ? statusState.value : null
  const recipientBatchKey = useMemo(
    () => getCodexInviteRecipientBatchKey(emailInput),
    [emailInput]
  )
  const consentConfirmed =
    consentState?.channelId === props.channelId &&
    consentState.batchKey === recipientBatchKey
      ? consentState.value
      : false
  const error =
    errorState?.channelId === props.channelId ? errorState.value : ''
  const rules = useMemo(() => extractRules(status), [status])
  const statusError = useMemo(() => extractStatusErrors(status), [status])
  const requiresConsent = shouldRequireConsent(status)
  const isSendAllowed = canSendCodexInvite({
    isLoadingStatus,
    status,
    statusError,
  })

  useEffect(() => {
    latestPanelStateRef.current = {
      open: props.open,
      channelId: props.channelId,
    }
  }, [props.open, props.channelId])

  const loadStatus = useCallback(async () => {
    if (!props.open) return
    const requestId = statusRequestIdRef.current + 1
    statusRequestIdRef.current = requestId
    const requestChannelId = props.channelId
    setIsLoadingStatus(true)
    setErrorState(null)
    try {
      const res = await getCodexInviteStatus(requestChannelId)
      const latest = latestPanelStateRef.current
      if (
        !isCurrentCodexInviteStatusRequest({
          currentRequestId: statusRequestIdRef.current,
          requestId,
          currentOpen: latest.open,
          currentChannelId: latest.channelId,
          requestChannelId,
        })
      ) {
        return
      }
      const failureMessage = getCodexInviteStatusFailureMessage(res)
      if (failureMessage) {
        setStatusState(null)
        setErrorState({ channelId: requestChannelId, value: t(failureMessage) })
        return
      }
      setStatusState({ channelId: requestChannelId, value: res })
    } catch {
      const latest = latestPanelStateRef.current
      if (
        !isCurrentCodexInviteStatusRequest({
          currentRequestId: statusRequestIdRef.current,
          requestId,
          currentOpen: latest.open,
          currentChannelId: latest.channelId,
          requestChannelId,
        })
      ) {
        return
      }
      setStatusState(null)
      setErrorState({
        channelId: requestChannelId,
        value: t('Failed to load Codex invite status'),
      })
    } finally {
      const latest = latestPanelStateRef.current
      if (
        isCurrentCodexInviteStatusRequest({
          currentRequestId: statusRequestIdRef.current,
          requestId,
          currentOpen: latest.open,
          currentChannelId: latest.channelId,
          requestChannelId,
        })
      ) {
        setIsLoadingStatus(false)
      }
    }
  }, [props.open, props.channelId, t])

  useEffect(() => {
    statusRequestIdRef.current += 1
    if (!props.open) return
    const timer = window.setTimeout(() => {
      void loadStatus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [props.open, props.channelId, loadStatus])

  const handleSend = async () => {
    try {
      if (!isSendAllowed) {
        throw new Error(
          statusError
            ? `${t('Failed to load Codex invite status')}: ${statusError}`
            : t('Failed to load Codex invite status')
        )
      }
      const emails = parseCodexInviteEmails(emailInput, t)
      if (requiresConsent && !consentConfirmed) {
        throw new Error(
          t('Confirm recipient consent before sending Codex invites')
        )
      }
      setErrorState(null)
      const result = await send(props.channelId, emails, {
        confirmedRecipientConsent: requiresConsent ? consentConfirmed : false,
      })
      if (result.ok) {
        setEmailInput('')
      } else if (result.failedEmails.length > 0) {
        setEmailInput(result.failedEmails.join('\n'))
      }
    } catch (err) {
      setErrorState({
        channelId: props.channelId,
        value:
          err instanceof Error ? err.message : t('Failed to send Codex invite'),
      })
    }
  }

  return (
    <section className='rounded-lg border p-4'>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2 text-sm font-medium'>
          <Gift className='h-4 w-4' />
          {t('Codex Invites')}
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={loadStatus}
          disabled={isLoadingStatus}
        >
          <RefreshCw className='mr-1.5 h-3.5 w-3.5' />
          {t('Refresh')}
        </Button>
      </div>

      {rules.length > 0 && (
        <ul className='text-muted-foreground mb-3 list-disc space-y-1 pl-5 text-xs'>
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      )}
      {statusError && (
        <div className='mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'>
          {t('Failed to load Codex invite status')}: {statusError}
        </div>
      )}

      <Textarea
        value={emailInput}
        onChange={(event) => setEmailInput(event.target.value)}
        placeholder={t(
          'Enter invite emails separated by comma, space, or new line'
        )}
        className='min-h-24 font-mono text-sm'
      />
      <div className='text-muted-foreground mt-2 text-xs'>
        {t('Up to {{max}} invite emails at a time', {
          max: maxCodexInviteEmails,
        })}
      </div>

      {requiresConsent && (
        <label className='mt-3 flex items-start gap-2 text-sm'>
          <Checkbox
            checked={consentConfirmed}
            onCheckedChange={(checked) =>
              setConsentState({
                channelId: props.channelId,
                batchKey: recipientBatchKey,
                value: checked === true,
              })
            }
          />
          <span>
            {t(
              'I confirm these recipients consented to receive Codex invite emails'
            )}
          </span>
        </label>
      )}

      {error && (
        <div className='mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400'>
          {error}
        </div>
      )}

      <Button
        type='button'
        className='mt-3'
        onClick={handleSend}
        disabled={isSending || !isSendAllowed}
      >
        <Mail className='mr-1.5 h-3.5 w-3.5' />
        {isSending ? t('Sending Codex invite...') : t('Send Codex invite')}
      </Button>
    </section>
  )
}
