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
import { ExternalLink, Loader2 } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconGithub } from '@/assets/brand-icons'
import { CopyButton } from '@/components/copy-button'
import { LoadingState } from '@/components/loading-state'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getServerErrorMessage } from '@/lib/server-error-message'

import {
  cancelCopilotLogin,
  getCopilotChannelStatus,
  getCopilotLoginStatus,
  startCopilotLogin,
  type CopilotChannelStatus,
  type CopilotLoginState,
} from '../api'

interface CopilotAccountConnectProps {
  value: string
  channelId?: number
  disabled?: boolean
  onChange: (value: string) => void
}

interface CopilotCredential {
  profileId: string
  login?: string
}

function parseCredential(value: string): CopilotCredential | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    const record = parsed as Record<string, unknown>
    if (typeof record.profile_id !== 'string' || !record.profile_id.trim()) {
      return null
    }
    return {
      profileId: record.profile_id,
      login: typeof record.login === 'string' ? record.login : undefined,
    }
  } catch {
    return null
  }
}

export function CopilotAccountConnect(props: CopilotAccountConnectProps) {
  const { t } = useTranslation()
  const [attempt, setAttempt] = useState<CopilotLoginState | null>(null)
  const [starting, setStarting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [savedStatus, setSavedStatus] = useState<CopilotChannelStatus | null>(
    null
  )
  const [error, setError] = useState('')
  const completedAttemptRef = useRef<string | null>(null)
  const credential = parseCredential(props.value)
  const hasCredential = credential !== null
  const displayCredential =
    credential ??
    (savedStatus?.authenticated
      ? { profileId: savedStatus.profile_id, login: savedStatus.login }
      : null)
  const hasExistingProfile = Boolean(displayCredential || savedStatus)
  const active = attempt?.status === 'starting' || attempt?.status === 'waiting'
  const attemptId = attempt?.id

  const completeLogin = useEffectEvent((state: CopilotLoginState) => {
    if (!state.login) return
    if (completedAttemptRef.current === state.id) return
    completedAttemptRef.current = state.id
    props.onChange(
      JSON.stringify({ profile_id: state.profile_id, login: state.login })
    )
    setSavedStatus({
      profile_id: state.profile_id,
      login: state.login,
      authenticated: true,
    })
  })

  useEffect(() => {
    if (!props.channelId || hasCredential) {
      setSavedStatus(null)
      return
    }
    let cancelled = false
    setCheckingStatus(true)
    void getCopilotChannelStatus(props.channelId)
      .then((status) => {
        if (!cancelled) setSavedStatus(status)
      })
      .catch((statusError) => {
        if (!cancelled) {
          setError(
            getServerErrorMessage(
              statusError,
              t('Unable to read the connected GitHub Copilot account')
            )
          )
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingStatus(false)
      })
    return () => {
      cancelled = true
    }
  }, [hasCredential, props.channelId, t])

  useEffect(() => {
    if (!attemptId || !active) return
    let stopped = false
    const timer = window.setInterval(async () => {
      try {
        const next = await getCopilotLoginStatus(attemptId)
        if (stopped) return
        setAttempt(next)
        if (next.status === 'connected') {
          completeLogin(next)
        }
        if (
          next.status === 'failed' ||
          next.status === 'cancelled' ||
          next.status === 'expired'
        ) {
          setError(next.message || t('GitHub sign-in did not complete'))
        }
      } catch (statusError) {
        if (stopped) return
        setError(
          getServerErrorMessage(
            statusError,
            t('Unable to check sign-in status')
          )
        )
        setAttempt(null)
      }
    }, 1500)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [active, attemptId, t])

  const handleStart = async () => {
    setStarting(true)
    setError('')
    try {
      const state = await startCopilotLogin()
      completedAttemptRef.current = null
      setAttempt(state)
    } catch (startError) {
      setError(
        getServerErrorMessage(startError, t('Unable to start GitHub sign-in'))
      )
    } finally {
      setStarting(false)
    }
  }

  const handleCancel = async () => {
    if (!attempt) return
    setCancelling(true)
    try {
      const state = await cancelCopilotLogin(attempt.id)
      setAttempt(state)
    } catch (cancelError) {
      setError(
        getServerErrorMessage(cancelError, t('Unable to cancel GitHub sign-in'))
      )
    } finally {
      setCancelling(false)
    }
  }

  let connectionBadgeVariant: 'secondary' | 'outline' | 'destructive' =
    'outline'
  let connectionBadgeLabel = t('Not connected')
  if (displayCredential) {
    connectionBadgeVariant = 'secondary'
    connectionBadgeLabel = displayCredential.login
      ? t('Connected as {{login}}', { login: displayCredential.login })
      : t('Connected')
  } else if (checkingStatus) {
    connectionBadgeLabel = t('Checking connection...')
  } else if (savedStatus) {
    connectionBadgeVariant = 'destructive'
    connectionBadgeLabel = t('Signed out')
  }

  return (
    <div className='border-border/60 flex flex-col gap-3 rounded-lg border p-4'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-2'>
          <IconGithub className='size-4' />
          <span className='font-medium'>{t('GitHub Copilot account')}</span>
          <Badge variant={connectionBadgeVariant}>{connectionBadgeLabel}</Badge>
        </div>
        {!active && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={props.disabled || starting}
            onClick={handleStart}
          >
            {starting ? (
              <Loader2 className='mr-2 size-4 animate-spin' />
            ) : (
              <IconGithub className='mr-2 size-4' />
            )}
            {hasExistingProfile
              ? t('Reconnect GitHub Copilot')
              : t('Connect GitHub Copilot')}
          </Button>
        )}
      </div>

      {active && attempt && (
        <>
          <LoadingState
            inline
            size='sm'
            message={t('Waiting for GitHub authorization...')}
          />
          {attempt.verification_url && attempt.user_code ? (
            <div className='flex flex-col gap-3'>
              <p className='text-muted-foreground text-sm'>
                {t('Open the GitHub device page, then enter this code:')}
              </p>
              <div className='flex flex-wrap items-center gap-2'>
                <Input
                  readOnly
                  value={attempt.user_code}
                  aria-label={t('GitHub device code')}
                  className='max-w-52 font-mono text-lg tracking-widest'
                />
                <CopyButton
                  value={attempt.user_code}
                  variant='outline'
                  size='sm'
                  tooltip={t('Copy code')}
                >
                  {t('Copy code')}
                </CopyButton>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  render={
                    <a
                      href={attempt.verification_url}
                      target='_blank'
                      rel='noreferrer'
                    />
                  }
                >
                  <ExternalLink className='mr-2 size-4' />
                  {t('Open GitHub device page')}
                </Button>
                <CopyButton
                  value={attempt.verification_url}
                  variant='ghost'
                  size='sm'
                  tooltip={t('Copy link')}
                >
                  {t('Copy link')}
                </CopyButton>
              </div>
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('Preparing GitHub device authorization...')}
            </p>
          )}
          <div>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? t('Cancelling...') : t('Cancel GitHub sign-in')}
            </Button>
          </div>
        </>
      )}

      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <p className='text-muted-foreground text-xs'>
        {t(
          'Sign-in uses the official GitHub Copilot CLI. New API stores only the profile ID and GitHub login, never the GitHub token.'
        )}
      </p>
    </div>
  )
}
