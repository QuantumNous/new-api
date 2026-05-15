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
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Loader2, MessageCircleWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ChatKeySelectSheet } from '@/features/chat/components/chat-key-select-sheet'
import {
  fetchChatKeySecret,
  useChatKeyOptions,
} from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import {
  chatLinkRequiresApiKey,
  resolveChatUrl,
} from '@/features/chat/lib/chat-links'
import type { ApiKey } from '@/features/keys/types'

export const Route = createFileRoute('/_authenticated/chat/$chatId')({
  loader: async ({ params }) => {
    if (!Number.isInteger(Number(params.chatId))) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ChatRouteComponent,
})

function ChatRouteComponent() {
  const { t } = useTranslation()
  const { chatId } = Route.useParams()
  const { chatPresets, serverAddress } = useChatPresets()
  const [activeKey, setActiveKey] = useState<string>()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingKeyId, setPendingKeyId] = useState<number | null>(null)
  const hasNotifiedNoToken = useRef(false)
  const autoSelectedKeyId = useRef<number | null>(null)
  const hasOpenedSelection = useRef(false)

  const preset = useMemo(() => {
    const index = Number(chatId)
    if (!Number.isInteger(index)) return undefined
    return chatPresets[index]
  }, [chatId, chatPresets])

  const isWebLink = preset?.type === 'web'

  const requiresActiveKey = useMemo(() => {
    if (!preset || !isWebLink) return false
    return chatLinkRequiresApiKey(preset.url ?? '')
  }, [isWebLink, preset])

  const {
    data: apiKeys,
    isPending,
    isError,
    error,
  } = useChatKeyOptions(Boolean(preset && requiresActiveKey))

  const handleSelectKey = useCallback(
    async (apiKey: ApiKey) => {
      if (pendingKeyId) return

      setPendingKeyId(apiKey.id)
      try {
        const secret = await fetchChatKeySecret(apiKey)
        setActiveKey(secret)
        setSheetOpen(false)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t(
                'Unable to prepare chat link. Please ensure you have an enabled API key.'
              )
        toast.error(message)
      } finally {
        setPendingKeyId(null)
      }
    },
    [pendingKeyId, t]
  )

  useEffect(() => {
    setActiveKey(undefined)
    setSheetOpen(false)
    setPendingKeyId(null)
    hasNotifiedNoToken.current = false
    autoSelectedKeyId.current = null
    hasOpenedSelection.current = false
  }, [chatId])

  useEffect(() => {
    if (!preset || !requiresActiveKey || activeKey) return
    if (isPending && !apiKeys) return
    if (isError) return

    const enabledKeys = apiKeys ?? []
    if (enabledKeys.length === 0) {
      if (!hasNotifiedNoToken.current) {
        toast.error(t('No enabled tokens available'))
        hasNotifiedNoToken.current = true
      }
      return
    }

    if (enabledKeys.length === 1) {
      if (autoSelectedKeyId.current === enabledKeys[0].id) return
      autoSelectedKeyId.current = enabledKeys[0].id
      void handleSelectKey(enabledKeys[0])
      return
    }

    if (!hasOpenedSelection.current) {
      hasOpenedSelection.current = true
      setSheetOpen(true)
    }
  }, [
    activeKey,
    apiKeys,
    handleSelectKey,
    isError,
    isPending,
    preset,
    requiresActiveKey,
    t,
  ])

  const iframeSrc = useMemo(() => {
    if (!preset || !isWebLink) return ''
    if (requiresActiveKey && !activeKey) return ''
    return resolveChatUrl({
      template: preset.url,
      apiKey: requiresActiveKey ? activeKey : undefined,
      serverAddress,
    })
  }, [activeKey, isWebLink, preset, requiresActiveKey, serverAddress])

  if (!preset) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
        <MessageCircleWarning className='text-muted-foreground h-12 w-12' />
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold'>
            {t('Chat preset not found')}
          </h2>
          <p className='text-muted-foreground'>
            {t('The requested chat preset does not exist or has been removed.')}
          </p>
        </div>
        <Button variant='outline' render={<Link to='/dashboard' />}>
          {t('Return to dashboard')}
        </Button>
      </div>
    )
  }

  if (!isWebLink) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
        <MessageCircleWarning className='text-muted-foreground h-12 w-12' />
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold'>{t('Use sidebar shortcut')}</h2>
          <p className='text-muted-foreground'>
            {preset.name}{' '}
            {t(
              'opens in an external client. Trigger it from the sidebar or API key actions to launch the configured application.'
            )}
          </p>
        </div>
        <Button variant='outline' render={<Link to='/dashboard' />}>
          {t('Return to dashboard')}
        </Button>
      </div>
    )
  }

  if (requiresActiveKey && ((isPending && !apiKeys) || pendingKeyId)) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
        <p className='text-muted-foreground text-sm'>
          {t('Preparing your chat link…')}
        </p>
      </div>
    )
  }

  if (
    requiresActiveKey &&
    (isError || (apiKeys && apiKeys.length === 0) || (!activeKey && !sheetOpen))
  ) {
    const message =
      error instanceof Error ? error.message : t('No enabled tokens available')
    return (
      <div className='flex h-full flex-col items-center justify-center p-6'>
        <Alert variant='destructive' className='max-w-xl'>
          <AlertTitle>{t('Unable to open chat')}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (requiresActiveKey && !activeKey) {
    return (
      <>
        <div className='flex h-full flex-col items-center justify-center gap-4'>
          <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
          <p className='text-muted-foreground text-sm'>
            {t('Preparing your chat link…')}
          </p>
        </div>
        <ChatKeySelectSheet
          open={sheetOpen}
          apiKeys={apiKeys ?? []}
          pendingKeyId={pendingKeyId}
          onOpenChange={setSheetOpen}
          onSelect={handleSelectKey}
        />
      </>
    )
  }

  if (!requiresActiveKey && !iframeSrc) {
    return (
      <div className='flex h-full flex-col items-center justify-center p-6'>
        <Alert variant='destructive' className='max-w-xl'>
          <AlertTitle>{t('Unable to open chat')}</AlertTitle>
          <AlertDescription>
            {t(
              'Unable to generate chat link. Please contact your administrator.'
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <>
      <iframe
        src={iframeSrc}
        key={iframeSrc}
        className='h-full w-full border-0'
        allow='camera; microphone'
        title={`Chat preset: ${preset.name}`}
      />
      <ChatKeySelectSheet
        open={sheetOpen}
        apiKeys={apiKeys ?? []}
        pendingKeyId={pendingKeyId}
        onOpenChange={setSheetOpen}
        onSelect={handleSelectKey}
      />
    </>
  )
}
