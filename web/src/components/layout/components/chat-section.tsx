import { useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import {
  MessageSquare,
  ExternalLink,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { useStatus } from '@/hooks/use-status'
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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { resolveChatUrl, type ChatPreset } from '@/features/chat/lib/chat-links'
import { getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'

function useActiveChatKey(enabled: boolean) {
  const query = useQuery({
    queryKey: ['chat-active-key'],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 50 })
      if (!result.success) {
        throw new Error(result.message || 'Failed to load API keys')
      }
      const items = result.data?.items ?? []
      const active = items.find(
        (item) => item.status === API_KEY_STATUS.ENABLED
      )
      if (!active) {
        throw new Error(
          'No enabled API keys found. Create or enable one first.'
        )
      }
      return active.key
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return query
}

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
      <SidebarMenuSubItem key={preset.id}>
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
    <SidebarMenuSubItem key={preset.id}>
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

export function ChatSection() {
  const { chatPresets, serverAddress } = useChatPresets()
  const { status } = useStatus()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })

  const visiblePresets = useMemo(
    () => chatPresets.filter((preset) => preset.type !== 'fluent'),
    [chatPresets]
  )

  const hasKeyDependentPresets = useMemo(
    () =>
      visiblePresets.some(
        (preset) =>
          preset.url.includes('{key}') || preset.url.includes('{cherryConfig}')
      ),
    [visiblePresets]
  )

  const showKeyStatus = hasKeyDependentPresets

  const {
    data: activeKey,
    isPending: isKeyPending,
    error: keyError,
  } = useActiveChatKey(hasKeyDependentPresets)

  const chatModuleEnabled = useMemo(() => {
    const raw =
      (status?.SidebarModulesAdmin as string | undefined) ??
      (status?.sidebarModulesAdmin as string | undefined)
    if (!raw || raw.trim() === '') {
      return true
    }
    try {
      const parsed = JSON.parse(raw) as Record<
        string,
        { enabled?: boolean; [key: string]: unknown }
      >
      const chatConfig = parsed.chat
      if (!chatConfig || typeof chatConfig !== 'object') return true
      if (chatConfig.enabled === false) return false
      if (
        'chat' in chatConfig &&
        typeof chatConfig.chat === 'boolean' &&
        chatConfig.chat === false
      ) {
        return false
      }
      return true
    } catch {
      return true
    }
  }, [status?.SidebarModulesAdmin, status?.sidebarModulesAdmin])

  const handleOpenExternal = useCallback(
    (preset: ChatPreset) => {
      if (preset.type === 'web') return

      const requiresKey =
        preset.url.includes('{key}') || preset.url.includes('{cherryConfig}')

      if (requiresKey && isKeyPending) {
        toast.info('Preparing your chat link, please try again in a moment.')
        return
      }

      if (requiresKey && !activeKey) {
        const message =
          keyError instanceof Error
            ? keyError.message
            : 'Unable to prepare chat link. Please ensure you have an enabled API key.'
        toast.error(message)
        return
      }

      const url = resolveChatUrl({
        template: preset.url,
        apiKey: requiresKey ? activeKey : undefined,
        serverAddress,
      })

      if (!url) {
        toast.error('Invalid chat link. Please contact the administrator.')
        return
      }

      if (typeof window === 'undefined') return

      window.open(url, '_blank', 'noopener')
      setOpenMobile(false)
    },
    [activeKey, isKeyPending, keyError, serverAddress, setOpenMobile]
  )

  const activeHref = href.split('?')[0]
  const normalizedHref =
    activeHref.length > 1 ? activeHref.replace(/\/+$/, '') : activeHref

  if (!chatModuleEnabled || visiblePresets.length === 0) {
    return null
  }

  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Chat</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip='Chat'>
                  <MessageSquare className='h-4 w-4' />
                  <span>Chat</span>
                  <ChevronRight className='ms-auto h-4 w-4 opacity-70' />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                {visiblePresets.map((preset) => {
                  if (preset.type === 'web') {
                    return (
                      <DropdownMenuItem asChild key={preset.id}>
                        <Link to='/chat/$chatId' params={{ chatId: preset.id }}>
                          {preset.name}
                        </Link>
                      </DropdownMenuItem>
                    )
                  }
                  return (
                    <DropdownMenuItem
                      key={preset.id}
                      onClick={() => handleOpenExternal(preset)}
                    >
                      {preset.name}
                      <ExternalLink className='ml-auto h-4 w-4 opacity-70' />
                    </DropdownMenuItem>
                  )
                })}
                {showKeyStatus && <DropdownMenuSeparator />}
                {showKeyStatus && isKeyPending && (
                  <DropdownMenuItem disabled>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Preparing chat keys…
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Chat</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible
          asChild
          defaultOpen={normalizedHref.startsWith('/chat')}
          className='group/collapsible'
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton>
                <MessageSquare />
                <span>Chat</span>
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
                {showKeyStatus && isKeyPending && (
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton aria-disabled='true' tabIndex={-1}>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Preparing chat keys…
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroup>
  )
}
