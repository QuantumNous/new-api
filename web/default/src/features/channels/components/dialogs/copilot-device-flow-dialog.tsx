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
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/dialog'
import { pollCopilotDeviceFlow, startCopilotDeviceFlow } from '../../api'

type CopilotDeviceFlowDialogProps = {
  channelId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onAuthorized: () => void
}

export function CopilotDeviceFlowDialog(props: CopilotDeviceFlowDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flowActiveRef = useRef(false)
  const startRequestIdRef = useRef(0)
  const [state, setState] = useState({
    verificationUri: '',
    userCode: '',
    isStarting: false,
    isPolling: false,
    status: '',
  })

  const clearPollTimer = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    pollTimerRef.current = null
  }

  const stopPolling = () => {
    clearPollTimer()
    setState((current) => ({ ...current, isPolling: false }))
  }

  useEffect(() => {
    return () => {
      flowActiveRef.current = false
      clearPollTimer()
    }
  }, [])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      startRequestIdRef.current += 1
      flowActiveRef.current = false
      clearPollTimer()
      setState({
        verificationUri: '',
        userCode: '',
        isStarting: false,
        isPolling: false,
        status: '',
      })
    }
    props.onOpenChange(open)
  }

  const schedulePoll = (intervalSeconds: number) => {
    pollTimerRef.current = setTimeout(
      () => void handlePoll(intervalSeconds),
      intervalSeconds * 1000
    )
  }

  const handlePoll = async (intervalSeconds: number) => {
    if (!flowActiveRef.current) return
    try {
      const res = await pollCopilotDeviceFlow(props.channelId)
      if (!flowActiveRef.current) return
      const status = res.data?.status
      if (!res.success)
        throw new Error(res.message || t('Authorization failed'))

      if (status === 'authorized') {
        stopPolling()
        toast.success(t('GitHub authorization completed'))
        props.onAuthorized()
        handleOpenChange(false)
        return
      }
      if (status === 'expired' || status === 'denied') {
        stopPolling()
        setState((current) => ({
          ...current,
          status:
            status === 'expired'
              ? t('Authorization expired')
              : t('Authorization denied'),
        }))
        return
      }

      setState((current) => ({
        ...current,
        status: t('Waiting for GitHub authorization...'),
      }))
      schedulePoll(intervalSeconds)
    } catch (error) {
      if (!flowActiveRef.current) return
      setState((current) => ({
        ...current,
        status: t('Polling temporarily failed, retrying...'),
      }))
      schedulePoll(intervalSeconds)
    }
  }

  const handleStart = async () => {
    const requestId = ++startRequestIdRef.current
    setState((current) => ({ ...current, isStarting: true, status: '' }))
    try {
      const res = await startCopilotDeviceFlow(props.channelId)
      if (requestId !== startRequestIdRef.current || !props.open) return
      if (!res.success)
        throw new Error(res.message || t('Authorization failed'))

      const verificationUri = res.data?.verification_uri || ''
      const userCode = res.data?.user_code || ''
      if (!verificationUri || !userCode) {
        throw new Error(t('Authorization response is incomplete'))
      }

      const intervalSeconds = Math.max(res.data?.interval || 5, 1)
      flowActiveRef.current = true
      setState({
        verificationUri,
        userCode,
        isStarting: false,
        isPolling: true,
        status: t('Waiting for GitHub authorization...'),
      })
      window.open(verificationUri, '_blank', 'noopener,noreferrer')
      schedulePoll(intervalSeconds)
    } catch (error) {
      setState((current) => ({ ...current, isStarting: false }))
      toast.error(
        error instanceof Error ? error.message : t('Authorization failed')
      )
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={t('GitHub Copilot Authorization')}
      description={t('Authorize the saved channel with GitHub Device Flow.')}
      contentHeight='auto'
      footer={
        <Button
          type='button'
          variant='outline'
          onClick={() => handleOpenChange(false)}
        >
          {t('Close')}
        </Button>
      }
    >
      <div className='space-y-4'>
        <Alert>
          <AlertDescription>
            {t(
              'Open GitHub, enter the one-time code, and approve access. This dialog detects completion automatically.'
            )}
          </AlertDescription>
        </Alert>

        {!state.userCode ? (
          <Button
            type='button'
            onClick={handleStart}
            disabled={state.isStarting}
          >
            {state.isStarting ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <ExternalLink className='mr-2 h-4 w-4' />
            )}
            {t('Start GitHub authorization')}
          </Button>
        ) : (
          <div className='space-y-3'>
            <div className='space-y-2'>
              <div className='text-sm font-medium'>{t('One-time code')}</div>
              <div className='flex gap-2'>
                <Input
                  readOnly
                  value={state.userCode}
                  className='font-mono tracking-wider'
                />
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => void copyToClipboard(state.userCode)}
                  aria-label={t('Copy one-time code')}
                >
                  {copiedText === state.userCode ? (
                    <Check className='h-4 w-4 text-green-600' />
                  ) : (
                    <Copy className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type='button'
              variant='outline'
              onClick={() =>
                window.open(
                  state.verificationUri,
                  '_blank',
                  'noopener,noreferrer'
                )
              }
            >
              <ExternalLink className='mr-2 h-4 w-4' />
              {t('Open GitHub verification page')}
            </Button>
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              {state.isPolling && <Loader2 className='h-4 w-4 animate-spin' />}
              <span>{state.status}</span>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
