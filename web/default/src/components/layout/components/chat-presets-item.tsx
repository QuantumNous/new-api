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
import { useMemo, useCallback, useRef, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { ChatKeySelectSheet } from '@/features/chat/components/chat-key-select-sheet'
import {
  fetchChatKeyOptions,
  fetchChatKeySecret,
} from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import {
  chatLinkRequiresApiKey,
  resolveChatUrl,
  type ChatPreset,
} from '@/features/chat/lib/chat-links'
import type { ApiKey } from '@/features/keys/types'
import { normalizeHref } from '../lib/url-utils'

function ChatMenuItem({
  preset,
  active,
  loading,
  onOpen,
  onNavigate,
}: {
  preset: ChatPreset
  active: boolean
  loading: boolean
  onOpen: (preset: ChatPreset) => void | Promise<void>
  onNavigate: () => void
}) {
  if (preset.type === 'web') {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={preset.name}
          isActive={active}
          render={
            <Link
              to='/chat/$chatId'
              params={{ chatId: preset.id }}
              onClick={onNavigate}
            />
          }
        >
          <span className='min-w-0 flex-1 truncate whitespace-nowrap'>
            {preset.name}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={preset.name}
        onClick={() => {
          if (!loading) void onOpen(preset)
        }}
        aria-disabled={loading ? 'true' : undefined}
        isActive={false}
        className='justify-between'
      >
        <span className='min-w-0 flex-1 truncate whitespace-nowrap'>
          {preset.name}
        </span>
        {loading ? (
          <Loader2 className='h-4 w-4 shrink-0 animate-spin' />
        ) : (
          <ExternalLink className='h-4 w-4 shrink-0' />
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function ChatPresetsItem() {
  const { t } = useTranslation()
  const { chatPresets, serverAddress } = useChatPresets()
  const { setOpenMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })
  const [loadingPresetId, setLoadingPresetId] = useState<string | null>(null)
  const [selectingPreset, setSelectingPreset] = useState<ChatPreset | null>(
    null
  )
  const [availableKeys, setAvailableKeys] = useState<ApiKey[]>([])
  const [pendingKeyId, setPendingKeyId] = useState<number | null>(null)
  const loadingPresetIdRef = useRef<string | null>(null)

  const visiblePresets = useMemo(
    () => chatPresets.filter((preset) => preset.type !== 'fluent'),
    [chatPresets]
  )

  const openExternalPreset = useCallback(
    (preset: ChatPreset, activeKey?: string) => {
      const url = resolveChatUrl({
        template: preset.url,
        apiKey: activeKey,
        serverAddress,
      })

      if (!url) {
        toast.error(t('Invalid chat link. Please contact the administrator.'))
        return
      }

      if (typeof window === 'undefined') return

      window.open(url, '_blank', 'noopener')
      setOpenMobile(false)
    },
    [serverAddress, setOpenMobile, t]
  )

  const handleSelectExternalKey = useCallback(
    async (apiKey: ApiKey) => {
      if (!selectingPreset || pendingKeyId) return

      setPendingKeyId(apiKey.id)
      try {
        const secret = await fetchChatKeySecret(apiKey)
        setSelectingPreset(null)
        openExternalPreset(selectingPreset, secret)
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
    [openExternalPreset, pendingKeyId, selectingPreset, t]
  )

  const handleOpenExternal = useCallback(
    async (preset: ChatPreset) => {
      if (preset.type === 'web') return

      const needsKey = chatLinkRequiresApiKey(preset.url)

      if (!needsKey) {
        openExternalPreset(preset)
        return
      }

      if (loadingPresetIdRef.current) {
        toast.info(t('Preparing your chat link, please try again in a moment.'))
        return
      }

      loadingPresetIdRef.current = preset.id
      setLoadingPresetId(preset.id)
      try {
        const enabledKeys = await fetchChatKeyOptions()

        if (enabledKeys.length === 0) {
          toast.error(t('No enabled tokens available'))
          return
        }

        if (enabledKeys.length === 1) {
          const activeKey = await fetchChatKeySecret(enabledKeys[0])
          openExternalPreset(preset, activeKey)
          return
        }

        setAvailableKeys(enabledKeys)
        setSelectingPreset(preset)
        setOpenMobile(false)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t(
                'Unable to prepare chat link. Please ensure you have an enabled API key.'
              )
        toast.error(message)
      } finally {
        loadingPresetIdRef.current = null
        setLoadingPresetId(null)
      }
    },
    [openExternalPreset, setOpenMobile, t]
  )

  const normalizedHref = normalizeHref(href)

  if (visiblePresets.length === 0) {
    return null
  }

  return (
    <>
      {visiblePresets.map((preset) => (
        <ChatMenuItem
          key={preset.id}
          preset={preset}
          active={normalizedHref === `/chat/${preset.id}`}
          loading={loadingPresetId === preset.id}
          onOpen={handleOpenExternal}
          onNavigate={() => setOpenMobile(false)}
        />
      ))}
      <ChatKeySelectSheet
        open={Boolean(selectingPreset)}
        apiKeys={availableKeys}
        pendingKeyId={pendingKeyId}
        onOpenChange={(open) => {
          if (!open) setSelectingPreset(null)
        }}
        onSelect={handleSelectExternalKey}
      />
    </>
  )
}
