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
import { useQueryClient } from '@tanstack/react-query'
import {
  CircleCheck,
  CircleX,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { IconBadge } from '@/components/ui/icon-badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { formatTimestampToDate } from '@/lib/format'

import {
  initZcodeStartPlanAuth,
  pollZcodeStartPlanAuth,
  type ZcodeStartPlanAuthPollResponse,
  type ZcodeStartPlanAuthProvider,
} from '../../api'
import { channelsQueryKeys } from '../../lib'
import { useChannels } from '../channels-provider'

type ZcodeStartPlanAuthDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FlowPhase = 'idle' | 'starting' | 'authorizing' | 'failed' | 'ready'

const DEFAULT_POLL_INTERVAL_MS = 3000

export function ZcodeStartPlanAuthDialog({
  open,
  onOpenChange,
}: ZcodeStartPlanAuthDialogProps) {
  const { t } = useTranslation()
  const { currentRow } = useChannels()
  const queryClient = useQueryClient()

  const channelId = currentRow?.id
  const [provider, setProvider] = useState<ZcodeStartPlanAuthProvider>('zai')
  const [phase, setPhase] = useState<FlowPhase>('idle')
  const [authorizeUrl, setAuthorizeUrl] = useState('')
  const [failure, setFailure] = useState('')
  const [result, setResult] = useState<
    ZcodeStartPlanAuthPollResponse['data'] | null
  >(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closedRef = useRef(true)
  const generationRef = useRef(0)
  const busyRef = useRef(false)

  const clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  const resetState = useCallback(() => {
    generationRef.current += 1
    clearPollTimer()
    busyRef.current = false
    setPhase('idle')
    setAuthorizeUrl('')
    setFailure('')
    setResult(null)
  }, [])

  const schedulePoll = useCallback(
    (channelId: number, delayMs: number, generation: number) => {
      clearPollTimer()
      pollTimerRef.current = setTimeout(async () => {
        if (closedRef.current || generation !== generationRef.current) return
        try {
          const response = await pollZcodeStartPlanAuth(channelId)
          if (closedRef.current || generation !== generationRef.current) return
          if (!response.success) {
            // 后端会话丢失/网络抖动：提示但不终止，等待下一次轮询重试。
            schedulePoll(channelId, delayMs, generation)
            return
          }
          const status = response.data?.status
          if (status === 'ready') {
            busyRef.current = false
            setPhase('ready')
            setResult(response.data ?? null)
            if (response.data?.provider) setProvider(response.data.provider)
            toast.success(t('Authorization succeeded, channel key updated'))
            await queryClient.invalidateQueries({
              queryKey: channelsQueryKeys.lists(),
            })
            return
          }
          if (status === 'failed') {
            busyRef.current = false
            setAuthorizeUrl('')
            setPhase('failed')
            setFailure(t('Authorization failed or was cancelled'))
            return
          }
          if (status === 'expired') {
            busyRef.current = false
            setAuthorizeUrl('')
            setPhase('failed')
            setFailure(t('Authorization flow expired, please retry'))
            return
          }
          schedulePoll(channelId, delayMs, generation)
        } catch {
          if (!closedRef.current && generation === generationRef.current) {
            schedulePoll(channelId, delayMs, generation)
          }
        }
      }, delayMs)
    },
    [queryClient, t]
  )

  const startFlow = useCallback(async () => {
    if (!channelId || closedRef.current || busyRef.current) return
    busyRef.current = true
    const generation = ++generationRef.current
    clearPollTimer()
    setFailure('')
    setResult(null)
    setAuthorizeUrl('')
    setPhase('starting')
    try {
      const response = await initZcodeStartPlanAuth(channelId, provider)
      if (closedRef.current || generation !== generationRef.current) return
      if (!response.success || !response.data?.authorize_url) {
        busyRef.current = false
        setPhase('failed')
        setFailure(response.message || t('Failed to start authorization'))
        return
      }
      if (response.data.provider) setProvider(response.data.provider)
      setAuthorizeUrl(response.data.authorize_url)
      const intervalSec = Number(response.data.poll_interval_sec)
      const delayMs =
        Number.isFinite(intervalSec) && intervalSec > 0
          ? Math.max(intervalSec * 1000, 1000)
          : DEFAULT_POLL_INTERVAL_MS
      setPhase('authorizing')
      schedulePoll(channelId, delayMs, generation)
    } catch (error: unknown) {
      if (closedRef.current || generation !== generationRef.current) return
      busyRef.current = false
      setPhase('failed')
      setFailure(
        error instanceof Error
          ? error.message
          : t('Failed to start authorization')
      )
    }
  }, [channelId, provider, schedulePoll, t])

  useEffect(() => {
    closedRef.current = !open
    resetState()
    setProvider('zai')
    return () => {
      closedRef.current = true
      generationRef.current += 1
      clearPollTimer()
    }
  }, [open, channelId, resetState])

  if (!currentRow) return null

  const handleClose = () => {
    closedRef.current = true
    generationRef.current += 1
    clearPollTimer()
    onOpenChange(false)
  }

  const jwtExpiresAt = result?.jwt_expires_at

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
      }}
      title={t('StartPlan Re-authorization')}
      description={
        <>
          {t('Re-authorize ZCode StartPlan for:')}
          <strong>{currentRow.name}</strong>
        </>
      }
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <Button variant='outline' onClick={handleClose}>
          {t('Close')}
        </Button>
      }
    >
      <div className='space-y-4 py-4'>
        <div className='bg-muted/50 rounded-lg border p-4'>
          <div className='text-muted-foreground mb-2 flex items-center gap-2 text-sm'>
            <IconBadge tone='info' size='xs'>
              <KeyRound />
            </IconBadge>
            <span>{t('ZCode StartPlan uses a JWT channel key')}</span>
          </div>
          <div className='text-muted-foreground text-xs'>
            {t(
              'The official client has no refresh token flow. When the JWT expires, authorize again with the selected provider. The new key is saved automatically.'
            )}
          </div>
        </div>

        <FieldSet disabled={phase !== 'idle'}>
          <FieldLegend variant='label'>
            {t('Authorization provider')}
          </FieldLegend>
          <RadioGroup
            value={provider}
            disabled={phase !== 'idle'}
            onValueChange={(value) => {
              if (
                phase === 'idle' &&
                (value === 'zai' || value === 'bigmodel')
              ) {
                setProvider(value)
              }
            }}
          >
            <FieldGroup className='gap-3'>
              <Field orientation='horizontal' data-disabled={phase !== 'idle'}>
                <RadioGroupItem value='zai' id='start-plan-zai' />
                <FieldLabel htmlFor='start-plan-zai'>
                  {t('Z.ai (International)')}
                </FieldLabel>
              </Field>
              <Field orientation='horizontal' data-disabled={phase !== 'idle'}>
                <RadioGroupItem value='bigmodel' id='start-plan-bigmodel' />
                <FieldLabel htmlFor='start-plan-bigmodel'>
                  {t('BigModel (China)')}
                </FieldLabel>
              </Field>
            </FieldGroup>
          </RadioGroup>
        </FieldSet>

        {phase === 'starting' && (
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Loader2 className='h-4 w-4 animate-spin' />
            {t('Initializing authorization flow…')}
          </div>
        )}

        {phase === 'authorizing' && authorizeUrl && (
          <div className='space-y-2'>
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <Loader2 className='h-4 w-4 animate-spin' />
              {t('Waiting for authorization to complete…')}
            </div>
            <Button
              className='w-full'
              onClick={() => window.open(authorizeUrl, '_blank', 'noopener')}
            >
              <ExternalLink className='mr-2 h-4 w-4' />
              {t('Open Authorization Page')}
            </Button>
          </div>
        )}

        {phase === 'ready' && (
          <div className='space-y-2'>
            <div className='flex items-center gap-2 text-sm'>
              <IconBadge tone='success' size='xs'>
                <CircleCheck />
              </IconBadge>
              <span>{t('Authorization succeeded, channel key updated')}</span>
            </div>
            {result?.user_name && (
              <div className='text-muted-foreground text-xs'>
                {t('Account:')} {result.user_name}
                {result.email ? ` (${result.email})` : ''}
              </div>
            )}
            {jwtExpiresAt ? (
              <div className='text-muted-foreground text-xs'>
                {t('JWT Expires At')}{' '}
                {formatTimestampToDate(jwtExpiresAt * 1000)}
              </div>
            ) : null}
          </div>
        )}

        {failure && (
          <div className='flex items-center gap-2 text-sm'>
            <IconBadge tone='destructive' size='xs'>
              <CircleX />
            </IconBadge>
            <span>{failure}</span>
          </div>
        )}

        {(phase === 'idle' || phase === 'failed') && (
          <Button className='w-full' onClick={startFlow} disabled={!currentRow}>
            <RefreshCw className='mr-2 h-4 w-4' />
            {phase === 'failed' ? t('Retry') : t('Start Authorization')}
          </Button>
        )}
        {(phase === 'failed' || phase === 'ready') && (
          <Button className='w-full' variant='outline' onClick={resetState}>
            {phase === 'ready' ? t('Start new authorization') : t('Back')}
          </Button>
        )}
      </div>
    </Dialog>
  )
}
