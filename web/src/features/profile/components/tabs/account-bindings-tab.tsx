import { useMemo } from 'react'
import { Mail, Github, Shield, Send } from 'lucide-react'
import { SiWechat, SiLinux } from 'react-icons/si'
import {
  handleGitHubOAuth,
  handleOIDCOAuth,
  handleLinuxDOOAuth,
} from '@/lib/oauth'
import { useDialogs } from '@/hooks/use-dialogs'
import { useStatus } from '@/hooks/use-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  const dialogs = useDialogs<DialogKey>()
  const { status, loading } = useStatus()

  // Memoize bindings to prevent unnecessary recalculations
  const bindings: BindingItem[] = useMemo(() => {
    if (!profile || !status) return []

    return [
      {
        id: 'email',
        label: 'Email',
        icon: Mail,
        value: profile.email,
        isBound: Boolean(profile.email),
        isEnabled: true,
        onBind: () => dialogs.open('email'),
      },
      {
        id: 'wechat',
        label: 'WeChat',
        icon: SiWechat as any,
        value: undefined,
        isBound: Boolean((profile as any).wechat_id),
        isEnabled: status?.wechat_login || false,
        onBind: () => dialogs.open('wechat'),
      },
      {
        id: 'github',
        label: 'GitHub',
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
        id: 'oidc',
        label: 'OIDC',
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
        label: 'Telegram',
        icon: Send,
        value: (profile as any).telegram_id,
        isBound: Boolean((profile as any).telegram_id),
        isEnabled: status?.telegram_oauth || false,
        onBind: () => dialogs.open('telegram'),
      },
      {
        id: 'linuxdo',
        label: 'LinuxDO',
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
  }, [profile, status])

  if (!profile || loading) return null

  return (
    <>
      <div className='space-y-3'>
        {bindings.map((binding) => (
          <div
            key={binding.id}
            className='flex items-center justify-between rounded-lg border p-4'
          >
            <div className='flex items-center gap-4'>
              <div className='bg-muted rounded-md p-2'>
                <binding.icon className='h-5 w-5' />
              </div>
              <div>
                <div className='flex items-center gap-2'>
                  <p className='font-medium'>{binding.label}</p>
                  {binding.isBound && (
                    <Badge variant='outline' className='text-xs'>
                      Bound
                    </Badge>
                  )}
                </div>
                <p className='text-muted-foreground text-sm'>
                  {binding.value || 'Not bound'}
                </p>
              </div>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={binding.onBind}
              disabled={binding.isBound && binding.id !== 'email'}
            >
              {binding.isBound
                ? binding.id === 'email'
                  ? 'Change'
                  : 'Bound'
                : 'Bind'}
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
