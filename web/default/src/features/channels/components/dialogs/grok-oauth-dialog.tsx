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
import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Copy, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/dialog'
import {
  completeGrokPKCE,
  startGrokPKCE,
  GROK_OAUTH_REDIRECT_URI,
} from '../../api'
import {
  normalizeGrokOAuthChannelID,
  resolveGrokOAuthCompletionKey,
} from '../../lib/grok-oauth'

type GrokOAuthDialogProps = {
  channelId?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onAuthorized: (key?: string) => void
}

export function GrokOAuthDialog({
  channelId,
  open,
  onOpenChange,
  onAuthorized,
}: GrokOAuthDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })

  const [state, setState] = useState({
    authorizeUrl: '',
    flowId: '',
    callbackUrl: '',
    isStarting: false,
    isCompleting: false,
  })

  useEffect(() => {
    if (!open) {
      setState({
        authorizeUrl: '',
        flowId: '',
        callbackUrl: '',
        isStarting: false,
        isCompleting: false,
      })
    }
  }, [open])

  const canCopyAuthorizeUrl = Boolean(state.authorizeUrl && !state.isStarting)
  const canComplete = useMemo(
    () =>
      Boolean(state.callbackUrl.trim()) &&
      Boolean(state.flowId) &&
      !state.isCompleting,
    [state.callbackUrl, state.flowId, state.isCompleting]
  )

  const handleStart = async () => {
    setState((prev) => ({ ...prev, isStarting: true }))
    try {
      const res = await startGrokPKCE(
        normalizeGrokOAuthChannelID(channelId),
        GROK_OAUTH_REDIRECT_URI
      )
      if (!res.success) {
        throw new Error(res.message || 'Failed to start OAuth')
      }

      const url = res.data?.authorize_url || ''
      const flowId = res.data?.flow_id || ''
      if (!url || !flowId) {
        throw new Error('Missing authorize_url or flow_id in response')
      }

      setState((prev) => ({ ...prev, authorizeUrl: url, flowId }))
      try {
        // window.open returns null when the popup is blocked (no exception thrown),
        // so a bare call would still toast success and mislead the user. Branch on it.
        const win = window.open(url, '_blank', 'noopener,noreferrer')
        if (!win) {
          toast.warning(t('Please manually copy and open the authorization link'))
        } else {
          toast.success(t('Opened authorization page'))
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to open authorization page:', error)
        toast.warning(t('Please manually copy and open the authorization link'))
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('OAuth start failed')
      )
    } finally {
      setState((prev) => ({ ...prev, isStarting: false }))
    }
  }

  const handleComplete = async () => {
    const callbackUrl = state.callbackUrl.trim()
    if (!callbackUrl || !state.flowId) return

    // Parse code & state on the client. Grok's /pkce/complete expects the
    // decomposed { flow_id, code, state } (unlike Codex, which sends the raw
    // callback URL to the backend). A malformed URL throws from new URL().
    let code = ''
    let stateParam = ''
    try {
      const parsed = new URL(callbackUrl)
      code = parsed.searchParams.get('code') || ''
      stateParam = parsed.searchParams.get('state') || ''
    } catch {
      toast.error(
        t(
          'Invalid callback URL, please copy the full address including code and state'
        )
      )
      return
    }

    if (!code || !stateParam) {
      toast.error(
        t(
          'Invalid callback URL, please copy the full address including code and state'
        )
      )
      return
    }

    setState((prev) => ({ ...prev, isCompleting: true }))
    try {
      const res = await completeGrokPKCE(state.flowId, code, stateParam)
      if (!res.success) {
        throw new Error(res.message || 'OAuth failed')
      }

      const key = resolveGrokOAuthCompletionKey(channelId, res)
      toast.success(t('Grok authorization completed'))
      onAuthorized(key)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('OAuth failed'))
    } finally {
      setState((prev) => ({ ...prev, isCompleting: false }))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Grok Authorization')}
      description={t(
        channelId === undefined
          ? 'Authorize this new channel with Grok OAuth. The credential will be added to the form and saved only by Create Channel.'
          : 'Authorize this saved channel with Grok OAuth. Credentials are stored on the server automatically.'
      )}
      contentClassName='sm:max-w-2xl'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={state.isStarting || state.isCompleting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleComplete} disabled={!canComplete}>
            {state.isCompleting && (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            )}
            {state.isCompleting
              ? t('Completing...')
              : t('Complete authorization')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <Alert>
          <AlertDescription>
            {t(
              '1) Click "Open authorization page" and sign in to Grok. 2) Your browser will redirect to a localhost address (it is OK if the page does not load). 3) Copy the full URL from the address bar and paste it below. 4) Click "Complete authorization".'
            )}
          </AlertDescription>
        </Alert>

        <div className='flex flex-wrap gap-2'>
          <Button onClick={handleStart} disabled={state.isStarting}>
            {state.isStarting ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <ExternalLink className='mr-2 h-4 w-4' />
            )}
            {t('Open authorization page')}
          </Button>

          <Button
            type='button'
            variant='outline'
            disabled={!canCopyAuthorizeUrl}
            onClick={async () => {
              if (!state.authorizeUrl) return
              await copyToClipboard(state.authorizeUrl)
            }}
            aria-label={t('Copy authorization link')}
            title={t('Copy authorization link')}
          >
            {copiedText === state.authorizeUrl ? (
              <Check className='mr-2 h-4 w-4 text-green-600' />
            ) : (
              <Copy className='mr-2 h-4 w-4' />
            )}
            {t('Copy authorization link')}
          </Button>
        </div>

        <div className='space-y-2'>
          <div className='text-sm font-medium'>{t('Callback URL')}</div>
          <Input
            value={state.callbackUrl}
            onChange={(e) =>
              setState((prev) => ({ ...prev, callbackUrl: e.target.value }))
            }
            placeholder={t(
              'Paste the full callback URL (includes code & state)'
            )}
            autoComplete='off'
            spellCheck={false}
          />
        </div>
      </div>
    </Dialog>
  )
}
