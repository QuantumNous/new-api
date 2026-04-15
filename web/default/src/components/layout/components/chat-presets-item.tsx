import { useMemo, useCallback } from 'react'
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
  DropdownMenuSeparator,
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
import { useActiveChatKey } from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { resolveChatUrl, type ChatPreset } from '@/features/chat/lib/chat-links'
import { normalizeHref } from '../lib/url-utils'
import type { NavChatPresets } from '../types'

/**
 * Check if a preset requires an API key
 */
function requiresApiKey(preset: ChatPreset): boolean {
  return preset.url.includes('{key}') || preset.url.includes('{cherryConfig}')
}

/**
 * Sub-menu item for a single chat preset
 */
function ChatMenuItem({
  preset,
  active,
  onOpen,
  onNavigate,
}: {
  preset: ChatPreset
  active: boolean
  onOpen: (preset: ChatPreset) => void
  onNavigate: () => void
}) {
  if (preset.type === 'web') {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={active}>
          <Link
            to='/chat/$chatId'
            params={{ chatId: preset.id }}
            onClick={onNavigate}
          >
            <span>{preset.name}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        onClick={() => onOpen(preset)}
        isActive={false}
        className='justify-between'
      >
        <span>{preset.name}</span>
        <ExternalLink className='h-4 w-4' />
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

/**
 * Dropdown menu item for a single chat preset
 */
function DropdownPresetItem({
  preset,
  onOpen,
}: {
  preset: ChatPreset
  onOpen: (preset: ChatPreset) => void
}) {
  if (preset.type === 'web') {
    return (
      <DropdownMenuItem asChild>
        <Link to='/chat/$chatId' params={{ chatId: preset.id }}>
          {preset.name}
        </Link>
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem onClick={() => onOpen(preset)}>
      {preset.name}
      <ExternalLink className='ml-auto h-4 w-4 opacity-70' />
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
  const loadingMessage = t('Preparing chat keys…')

  const visiblePresets = useMemo(
    () => chatPresets.filter((preset) => preset.type !== 'fluent'),
    [chatPresets]
  )

  const hasKeyDependentPresets = useMemo(
    () => visiblePresets.some(requiresApiKey),
    [visiblePresets]
  )

  const {
    data: activeKey,
    isPending: isKeyPending,
    error: keyError,
  } = useActiveChatKey(hasKeyDependentPresets)

  const handleOpenExternal = useCallback(
    (preset: ChatPreset) => {
      if (preset.type === 'web') return

      const needsKey = requiresApiKey(preset)

      if (needsKey && isKeyPending) {
        toast.info(t('Preparing your chat link, please try again in a moment.'))
        return
      }

      if (needsKey && !activeKey) {
        const message =
          keyError instanceof Error
            ? keyError.message
            : t(
                'Unable to prepare chat link. Please ensure you have an enabled API key.'
              )
        toast.error(message)
        return
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
    [activeKey, isKeyPending, keyError, serverAddress, setOpenMobile, t]
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
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip={item.title}>
              {item.icon && <item.icon className='h-4 w-4' />}
              <span>{item.title}</span>
              <ChevronRight className='ms-auto h-4 w-4 opacity-70' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start'>
            {visiblePresets.map((preset) => (
              <DropdownPresetItem
                key={preset.id}
                preset={preset}
                onOpen={handleOpenExternal}
              />
            ))}
            {hasKeyDependentPresets && <DropdownMenuSeparator />}
            {hasKeyDependentPresets && isKeyPending && (
              <DropdownMenuItem disabled>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                {loadingMessage}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  // Expanded state - render collapsible menu
  return (
    <Collapsible
      asChild
      defaultOpen={normalizedHref.startsWith('/chat')}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            {visiblePresets.map((preset) => (
              <ChatMenuItem
                key={preset.id}
                preset={preset}
                active={normalizedHref === `/chat/${preset.id}`}
                onOpen={handleOpenExternal}
                onNavigate={() => setOpenMobile(false)}
              />
            ))}
            {hasKeyDependentPresets && isKeyPending && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton aria-disabled='true' tabIndex={-1}>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {loadingMessage}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
