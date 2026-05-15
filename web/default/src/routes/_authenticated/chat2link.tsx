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
import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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

export const Route = createFileRoute('/_authenticated/chat2link')({
  component: Chat2LinkPage,
})

export function Chat2LinkPage() {
  const { t } = useTranslation()
  const { chatPresets, serverAddress } = useChatPresets()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingKeyId, setPendingKeyId] = useState<number | null>(null)
  const hasNotifiedNoToken = useRef(false)
  const autoSelectedKeyId = useRef<number | null>(null)
  const hasOpenedSelection = useRef(false)

  const firstWebPreset = useMemo(
    () => chatPresets.find((p) => p.type === 'web'),
    [chatPresets]
  )

  const requiresActiveKey = useMemo(
    () =>
      Boolean(
        firstWebPreset && chatLinkRequiresApiKey(firstWebPreset.url ?? '')
      ),
    [firstWebPreset]
  )

  const {
    data: apiKeys,
    isPending: isLoadingKeys,
    error: keyError,
  } = useChatKeyOptions(Boolean(firstWebPreset && requiresActiveKey))

  const openResolvedChat = useCallback(
    (apiKey?: string) => {
      if (!firstWebPreset) return

      const url = resolveChatUrl({
        template: firstWebPreset.url,
        apiKey,
        serverAddress,
      })

      if (!url) {
        toast.error(t('Invalid chat link. Please contact the administrator.'))
        return
      }

      window.location.href = url
    },
    [firstWebPreset, serverAddress, t]
  )

  const handleSelectKey = useCallback(
    async (apiKey: ApiKey) => {
      if (pendingKeyId) return

      setPendingKeyId(apiKey.id)
      try {
        const secret = await fetchChatKeySecret(apiKey)
        setSheetOpen(false)
        openResolvedChat(secret)
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
    [openResolvedChat, pendingKeyId, t]
  )

  useEffect(() => {
    if (!firstWebPreset) {
      if (chatPresets.length > 0) {
        toast.error(t('No available Web chat links'))
      }
      return
    }

    if (!requiresActiveKey) {
      openResolvedChat()
      return
    }

    if (isLoadingKeys && !apiKeys) return

    if (keyError) {
      const message =
        keyError instanceof Error
          ? keyError.message
          : t('Unable to load API keys')
      toast.error(message)
      return
    }

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
    firstWebPreset,
    requiresActiveKey,
    isLoadingKeys,
    apiKeys,
    keyError,
    chatPresets.length,
    handleSelectKey,
    openResolvedChat,
    t,
  ])

  return (
    <>
      <div className='flex h-full flex-col items-center justify-center gap-3'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
        <p className='text-muted-foreground text-sm'>
          {pendingKeyId
            ? t('Preparing your chat link…')
            : t('Redirecting to chat page...')}
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
