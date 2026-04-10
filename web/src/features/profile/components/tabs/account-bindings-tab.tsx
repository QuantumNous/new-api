import { useEffect, useMemo } from 'react'
import { Mail, Github, Shield, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SiWechat, SiLinux } from 'react-icons/si'
import { IconDiscord } from '@/assets/brand-icons'
import {
  handleGitHubOAuth,
  handleOIDCOAuth,
  handleDiscordOAuth,
  handleLinuxDOOAuth,
} from '@/lib/oauth'
import { useDialogs } from '@/hooks/use-dialog'
import { useStatus } from '@/hooks/use-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OAUTH_BIND_STORAGE_KEY } from '@/features/auth/constants'
import type { UserProfile, BindingItem } from '../../types'
import { EmailBindDialog } from '../dialogs/email-bind-dialog'
import { TelegramBindDialog } from '../dialogs/telegram-bind-dialog'
import { WeChatBindDialog } from '../dialogs/wechat-bind-dialog'

// ============================================================================
// Account Bindings Tab Component
// ============================================================================

interface AccountBindingsTabProps {
  profile: UserProfile | null
  onUpdate: () => void
}

type DialogKey = 'email' | 'wechat' | 'telegram'

export function AccountBindingsTab({
  profile,
  onUpdate,
}: AccountBindingsTabProps) {
  const { t } = useTranslation()
  const dialogs = useDialogs<DialogKey>()
  const { status, loading } = useStatus()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== OAUTH_BIND_STORAGE_KEY || !event.newValue) return
      try {
        const payload = JSON.parse(event.newValue) as {
          status?: string
          provider?: string
          timestamp?: number
        }
        if (payload?.status === 'success') {
          onUpdate()
        }
      } catch {
        // ignore malformed payloads
      }
      try {
        window.localStorage.removeItem(OAUTH_BIND_STORAGE_KEY)
      } catch {
        // ignore cleanup failure
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [onUpdate])

  // Memoize bindings to prevent unnecessary recalculations
  const bindings: BindingItem[] = useMemo(() => {
    if (!profile || !status) return []

    return [
      {
        id: 'email',
        label: t('Email'),
        icon: Mail,
        value: profile.email,
        isBound: Boolean(profile.email),
        isEnabled: true,
        onBind: () => dialogs.open('email'),
      },
      {
        id: 'wechat',
        label: t('WeChat'),
        icon: SiWechat as any,
        value: undefined,
        isBound: Boolean((profile as any).wechat_id),
        isEnabled: status?.wechat_login || false,
        onBind: () => dialogs.open('wechat'),
      },
      {
        id: 'github',
        label: t('GitHub'),
        icon: Github,
        value: (profile as any).github_id,
        isBound: Boolean((profile as any).github_id),
        isEnabled: status?.github_oauth || false,
        onBind: () => {
          if (status?.github_client_id) {
            handleGitHubOAuth(status.github_client_id)
          }
        },
      },
      {
        id: 'discord',
        label: t('Discord'),
        icon: IconDiscord,
        value: (profile as any).discord_id,
        isBound: Boolean((profile as any).discord_id),
        isEnabled: status?.discord_oauth || false,
        onBind: () => {
          if (status?.discord_client_id) {
            handleDiscordOAuth(status.discord_client_id)
          }
        },
      },
      {
        id: 'oidc',
        label: t('OIDC'),
        icon: Shield,
        value: (profile as any).oidc_id,
        isBound: Boolean((profile as any).oidc_id),
        isEnabled: status?.oidc_enabled || false,
        onBind: () => {
          if (status?.oidc_authorization_endpoint && status?.oidc_client_id) {
            handleOIDCOAuth(
              status.oidc_authorization_endpoint,
              status.oidc_client_id
            )
          }
        },
      },
      {
        id: 'telegram',
        label: t('Telegram'),
        icon: Send,
        value: (profile as any).telegram_id,
        isBound: Boolean((profile as any).telegram_id),
        isEnabled: status?.telegram_oauth || false,
        onBind: () => dialogs.open('telegram'),
      },
      {
        id: 'linuxdo',
        label: t('LinuxDO'),
        icon: SiLinux as any,
        value: (profile as any).linux_do_id,
        isBound: Boolean((profile as any).linux_do_id),
        isEnabled: status?.linuxdo_oauth || false,
        onBind: () => {
          if (status?.linuxdo_client_id) {
            handleLinuxDOOAuth(status.linuxdo_client_id)
          }
        },
      },
    ].filter((binding) => binding.isEnabled)
  }, [profile, status, t])

  if (!profile || loading) return null

  return (
    <>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        {bindings.map((binding) => (
          <div
            key={binding.id}
            className='flex items-center justify-between rounded-lg border p-3'
          >
            <div className='flex items-center gap-3'>
              <div className='bg-muted shrink-0 rounded-md p-2'>
                <binding.icon className='h-4 w-4' />
              </div>
              <div className='min-w-0'>
                <div className='flex items-center gap-1.5'>
                  <p className='text-sm font-medium'>{binding.label}</p>
                  {binding.isBound && (
                    <Badge variant='outline' className='text-[10px] px-1 py-0'>
                      {t('Bound')}
                    </Badge>
                  )}
                </div>
                <p className='text-muted-foreground truncate text-xs'>
                  {binding.value || t('Not bound')}
                </p>
              </div>
            </div>
            <Button
              variant='outline'
              size='sm'
              className='ml-2 shrink-0 h-7 px-2.5 text-xs'
              onClick={binding.onBind}
              disabled={binding.isBound && binding.id !== 'email'}
            >
              {binding.isBound
                ? binding.id === 'email'
                  ? t('Change')
                  : t('Bound')
                : t('Bind')}
            </Button>
          </div>
        ))}
      </div>

      {/* Email Bind Dialog */}
      <EmailBindDialog
        open={dialogs.isOpen('email')}
        onOpenChange={(open) =>
          open ? dialogs.open('email') : dialogs.close('email')
        }
        currentEmail={profile.email}
        onSuccess={onUpdate}
      />

      {/* WeChat Bind Dialog */}
      <WeChatBindDialog
        open={dialogs.isOpen('wechat')}
        onOpenChange={(open) =>
          open ? dialogs.open('wechat') : dialogs.close('wechat')
        }
        onSuccess={onUpdate}
      />

      {/* Telegram Bind Dialog */}
      {status?.telegram_bot_name && (
        <TelegramBindDialog
          open={dialogs.isOpen('telegram')}
          onOpenChange={(open) =>
            open ? dialogs.open('telegram') : dialogs.close('telegram')
          }
          botName={status.telegram_bot_name}
          onSuccess={onUpdate}
        />
      )}
    </>
  )
}
