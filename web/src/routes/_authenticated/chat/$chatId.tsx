import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Loader2, MessageCircleWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { resolveChatUrl } from '@/features/chat/lib/chat-links'
import { getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'

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
  const preset = useMemo(() => {
    const index = Number(chatId)
    if (!Number.isInteger(index)) return undefined
    return chatPresets[index]
  }, [chatId, chatPresets])

  const isWebLink = preset?.type === 'web'

  const requiresActiveKey = useMemo(() => {
    if (!preset || !isWebLink) return false
    const url = preset.url ?? ''
    return url.includes('{key}') || url.includes('{cherryConfig}')
  }, [isWebLink, preset])

  const {
    data: activeKey,
    isPending,
    isError,
    error,
  } = useQuery({
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
          'No enabled API key available. Please enable an API key first.'
        )
      }
      return active.key
    },
    enabled: Boolean(preset && requiresActiveKey),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

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
        <Button variant='outline' asChild>
          <Link to='/dashboard'>{t('Return to dashboard')}</Link>
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
        <Button variant='outline' asChild>
          <Link to='/dashboard'>{t('Return to dashboard')}</Link>
        </Button>
      </div>
    )
  }

  if (requiresActiveKey && isPending) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
        <p className='text-muted-foreground text-sm'>
          {t('Preparing your chat link…')}
        </p>
      </div>
    )
  }

  if (requiresActiveKey && (isError || !activeKey || !iframeSrc)) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to generate chat link. Please check your API keys.'
    return (
      <div className='flex h-full flex-col items-center justify-center p-6'>
        <Alert variant='destructive' className='max-w-xl'>
          <AlertTitle>{t('Unable to open chat')}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
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
    <iframe
      src={iframeSrc}
      key={iframeSrc}
      className='h-full w-full border-0'
      allow='camera; microphone'
      title={`Chat preset: ${preset.name}`}
    />
  )
}
