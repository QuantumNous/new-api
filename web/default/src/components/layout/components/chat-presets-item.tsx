import { useMemo, useCallback, useRef, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ExternalLink, Loader2, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { fetchActiveChatKey } from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import {
  chatLinkRequiresApiKey,
  resolveChatUrl,
  type ChatPreset,
} from '@/features/chat/lib/chat-links'
import { normalizeHref } from '../lib/url-utils'
import type { NavChatPresets } from '../types'

/**
 * Sub-menu item for a single chat preset
 */
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
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={active}
          render={
            <Link
              to='/chat/$chatId'
              params={{ chatId: preset.id }}
              onClick={onNavigate}
            />
          }
        >
          <span>{preset.name}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        onClick={() => {
          if (!loading) void onOpen(preset)
        }}
        aria-disabled={loading ? 'true' : undefined}
        isActive={false}
        className='justify-between'
      >
        <span>{preset.name}</span>
        {loading ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <ExternalLink className='h-4 w-4' />
        )}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

/**
 * Dropdown menu item for a single chat preset
 */
function DropdownPresetItem({
  preset,
  loading,
  onOpen,
}: {
  preset: ChatPreset
  loading: boolean
  onOpen: (preset: ChatPreset) => void | Promise<void>
}) {
  if (preset.type === 'web') {
    return (
      <DropdownMenuItem
        render={<Link to='/chat/$chatId' params={{ chatId: preset.id }} />}
      >
        {preset.name}
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem
      disabled={loading}
      onClick={() => {
        if (!loading) void onOpen(preset)
      }}
    >
      {preset.name}
      {loading ? (
        <Loader2 className='ml-auto h-4 w-4 animate-spin opacity-70' />
      ) : (
        <ExternalLink className='ml-auto h-4 w-4 opacity-70' />
      )}
    </DropdownMenuItem>
  )
}

/**
 * Dynamic chat presets navigation item
 */
export function ChatPresetsItem({ item }: { item: NavChatPresets }) {
  const { t } = useTranslation()
  const { chatPresets, serverAddress } = useChatPresets()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })
  const [loadingPresetId, setLoadingPresetId] = useState<string | null>(null)
  const loadingPresetIdRef = useRef<string | null>(null)

  const visiblePresets = useMemo(
    () => chatPresets.filter((preset) => preset.type !== 'fluent'),
    [chatPresets]
  )

  const handleOpenExternal = useCallback(
    async (preset: ChatPreset) => {
      if (preset.type === 'web') return

      const needsKey = chatLinkRequiresApiKey(preset.url)
      let activeKey: string | undefined

      if (needsKey && loadingPresetIdRef.current) {
        toast.info(t('Preparing your chat link, please try again in a moment.'))
        return
      }

      if (needsKey) {
        loadingPresetIdRef.current = preset.id
        setLoadingPresetId(preset.id)
        try {
          activeKey = await fetchActiveChatKey()
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t(
                  'Unable to prepare chat link. Please ensure you have an enabled API key.'
                )
          toast.error(message)
          return
        } finally {
          loadingPresetIdRef.current = null
          setLoadingPresetId(null)
        }
      }

      const url = resolveChatUrl({
        template: preset.url,
        apiKey: needsKey ? activeKey : undefined,
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

  const normalizedHref = normalizeHref(href)

  // Don't render if no visible presets
  if (visiblePresets.length === 0) {
    return null
  }

  // Collapsed state on non-mobile - render dropdown menu
  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton tooltip={item.title} />}
          >
            {item.icon && <item.icon className='h-4 w-4' />}
            <span>{item.title}</span>
            <ChevronRight className='ms-auto h-4 w-4 opacity-70' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start'>
            {visiblePresets.map((preset) => (
              <DropdownPresetItem
                key={preset.id}
                preset={preset}
                loading={loadingPresetId === preset.id}
                onOpen={handleOpenExternal}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  // Expanded state - render collapsible menu
  return (
    <Collapsible
      defaultOpen={normalizedHref.startsWith('/chat')}
      className='group/collapsible'
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        className='group/collapsible-trigger'
        render={<SidebarMenuButton />}
      >
        {item.icon && <item.icon />}
        <span>{item.title}</span>
        <ChevronRight className='ms-auto transition-transform duration-200 group-data-[panel-open]/collapsible-trigger:rotate-90' />
      </CollapsibleTrigger>
      <CollapsibleContent className='CollapsibleContent'>
        <SidebarMenuSub>
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
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}
