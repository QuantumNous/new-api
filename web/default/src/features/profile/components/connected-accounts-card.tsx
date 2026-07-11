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
import { Mail, Shield, Send, Link2, Unlink } from 'lucide-react'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SiGithub, SiWechat, SiLinux } from 'react-icons/si'
import { toast } from 'sonner'

import { IconDiscord } from '@/assets/brand-icons'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/design-system/button'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { OAUTH_BIND_STORAGE_KEY } from '@/features/auth/constants'
import { useDialogs } from '@/hooks/use-dialog'
import { useStatus } from '@/hooks/use-status'
import {
  handleGitHubOAuth,
  handleOIDCOAuth,
  handleDiscordOAuth,
  handleLinuxDOOAuth,
} from '@/lib/oauth'

import {
  getSelfOAuthBindings,
  unbindCustomOAuth,
  type CustomOAuthBinding,
} from '../api'
import type { UserProfile, BindingItem } from '../types'
import { EmailBindDialog } from './dialogs/email-bind-dialog'
import { TelegramBindDialog } from './dialogs/telegram-bind-dialog'
import { WeChatBindDialog } from './dialogs/wechat-bind-dialog'

interface ConnectedAccountsCardProps {
  profile: UserProfile | null
  loading: boolean
  onUpdate: () => void
}

type DialogKey = 'email' | 'wechat' | 'telegram'

export function ConnectedAccountsCard({
  profile,
  loading,
  onUpdate,
}: ConnectedAccountsCardProps) {
  const { t } = useTranslation()
  const dialogs = useDialogs<DialogKey>()
  const { status, loading: statusLoading } = useStatus()
  const [customBindings, setCustomBindings] = useState<CustomOAuthBinding[]>([])
  const [unbindTarget, setUnbindTarget] = useState<CustomOAuthBinding | null>(
    null
  )
  const [unbinding, setUnbinding] = useState(false)

  const customProviders = status?.custom_oauth_providers as
    | Array<{ id: string; name: string }>
    | undefined

  const fetchCustomBindings = useCallback(async () => {
    if (!customProviders || customProviders.length === 0) return
    try {
      const res = await getSelfOAuthBindings()
      if (res.success && res.data) {
        setCustomBindings(res.data)
      }
    } catch {
      // ignore
    }
  }, [customProviders])

  useEffect(() => {
    fetchCustomBindings()
  }, [fetchCustomBindings])

  const handleUnbindCustom = async () => {
    if (!unbindTarget) return
    setUnbinding(true)
    try {
      const res = await unbindCustomOAuth(unbindTarget.provider_id)
      if (res.success) {
        toast.success(
          t('Unbound {{provider}}', {
            provider: unbindTarget.provider_name,
          })
        )
        await fetchCustomBindings()
        onUpdate()
      } else {
        toast.error(res.message || t('Unbind failed'))
      }
    } catch {
      toast.error(t('Unbind failed'))
    } finally {
      setUnbinding(false)
      setUnbindTarget(null)
    }
  }

  const handleBindCustomOAuth = (provider: { id: string; name: string }) => {
    const redirectUrl = `${window.location.origin}/oauth/${provider.id}?bind=true`
    window.location.href = `/api/oauth/${provider.id}?redirect=${encodeURIComponent(redirectUrl)}`
  }

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
        icon: SiWechat as React.ComponentType<{ className?: string }>,
        value: undefined,
        isBound: Boolean(
          (profile as unknown as Record<string, unknown>).wechat_id
        ),
        isEnabled: status?.wechat_login || false,
        onBind: () => dialogs.open('wechat'),
      },
      {
        id: 'github',
        label: t('GitHub'),
        icon: SiGithub,
        value: (profile as unknown as Record<string, unknown>).github_id as
          | string
          | undefined,
        isBound: Boolean(
          (profile as unknown as Record<string, unknown>).github_id
        ),
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
        value: (profile as unknown as Record<string, unknown>).discord_id as
          | string
          | undefined,
        isBound: Boolean(
          (profile as unknown as Record<string, unknown>).discord_id
        ),
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
        value: (profile as unknown as Record<string, unknown>).oidc_id as
          | string
          | undefined,
        isBound: Boolean(
          (profile as unknown as Record<string, unknown>).oidc_id
        ),
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
        value: (profile as unknown as Record<string, unknown>).telegram_id as
          | string
          | undefined,
        isBound: Boolean(
          (profile as unknown as Record<string, unknown>).telegram_id
        ),
        isEnabled: status?.telegram_oauth || false,
        onBind: () => dialogs.open('telegram'),
      },
      {
        id: 'linuxdo',
        label: t('LinuxDO'),
        icon: SiLinux as React.ComponentType<{ className?: string }>,
        value: (profile as unknown as Record<string, unknown>).linux_do_id as
          | string
          | undefined,
        isBound: Boolean(
          (profile as unknown as Record<string, unknown>).linux_do_id
        ),
        isEnabled: status?.linuxdo_oauth || false,
        onBind: () => {
          if (status?.linuxdo_client_id) {
            handleLinuxDOOAuth(status.linuxdo_client_id)
          }
        },
      },
    ].filter((binding) => binding.isEnabled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, status, t])

  if (loading || statusLoading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-4 !pb-4 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-40' />
          <Skeleton className='mt-2 h-4 w-64' />
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 sm:gap-3 sm:p-5'>
          <Skeleton className='h-14 w-full rounded-lg' />
          <Skeleton className='h-14 w-full rounded-lg' />
          <Skeleton className='h-14 w-full rounded-lg' />
          <Skeleton className='h-14 w-full rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  if (!profile) return null

  return (
    <>
      <TitledCard
        title={t('Connected Accounts')}
        description={t('Link third-party accounts for sign-in and alerts')}
        disableHoverEffect
      >
        <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3'>
          {bindings.map((binding) => {
            let actionLabel = t('Bind')
            if (binding.isBound) {
              actionLabel = binding.id === 'email' ? t('Change') : t('Bound')
            }
            return (
              <div
                key={binding.id}
                className='flex items-center justify-between gap-3 rounded-lg border p-3'
              >
                <div className='flex min-w-0 items-center gap-3'>
                  <binding.icon className='text-muted-foreground size-4 shrink-0' />
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <p className='text-sm font-medium'>{binding.label}</p>
                      {binding.isBound && (
                        <StatusBadge variant='success'>
                          {t('Bound')}
                        </StatusBadge>
                      )}
                    </div>
                    <p className='text-muted-foreground truncate text-xs'>
                      {binding.value || t('Not bound')}
                    </p>
                  </div>
                </div>
                <Button
                  variant='outline'
                  className='shrink-0'
                  onClick={binding.onBind}
                  disabled={binding.isBound && binding.id !== 'email'}
                >
                  {actionLabel}
                </Button>
              </div>
            )
          })}

          {customProviders?.map((provider) => {
            const binding = customBindings.find(
              (b) => b.provider_id === provider.id
            )
            const isBound = !!binding
            return (
              <div
                key={provider.id}
                className='flex items-center justify-between gap-3 rounded-lg border p-3'
              >
                <div className='flex min-w-0 items-center gap-3'>
                  <Link2 className='text-muted-foreground size-4 shrink-0' />
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <p className='text-sm font-medium'>{provider.name}</p>
                      {isBound && (
                        <StatusBadge variant='success'>
                          {t('Bound')}
                        </StatusBadge>
                      )}
                    </div>
                    <p className='text-muted-foreground truncate text-xs'>
                      {isBound
                        ? binding?.external_id || t('Bound')
                        : t('Not bound')}
                    </p>
                  </div>
                </div>
                {isBound ? (
                  <Button
                    variant='ghost'
                    className='text-destructive shrink-0'
                    onClick={() => setUnbindTarget(binding)}
                  >
                    <Unlink className='mr-1 size-3' />
                    {t('Unbind')}
                  </Button>
                ) : (
                  <Button
                    variant='outline'
                    className='shrink-0'
                    onClick={() => handleBindCustomOAuth(provider)}
                  >
                    {t('Bind')}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </TitledCard>

      {/* Custom OAuth Unbind Confirmation */}
      <ConfirmDialog
        open={!!unbindTarget}
        onOpenChange={(open) => !open && setUnbindTarget(null)}
        title={t('Confirm Unbind')}
        desc={t(
          'Are you sure you want to unbind {{provider}}? You will no longer be able to log in via this method.',
          {
            provider: unbindTarget?.provider_name || '',
          }
        )}
        confirmText={t('Confirm Unbind')}
        destructive
        handleConfirm={handleUnbindCustom}
        isLoading={unbinding}
      />

      <EmailBindDialog
        open={dialogs.isOpen('email')}
        onOpenChange={(open) =>
          open ? dialogs.open('email') : dialogs.close('email')
        }
        currentEmail={profile.email}
        onSuccess={onUpdate}
      />

      <WeChatBindDialog
        open={dialogs.isOpen('wechat')}
        onOpenChange={(open) =>
          open ? dialogs.open('wechat') : dialogs.close('wechat')
        }
        onSuccess={onUpdate}
      />

      {status?.telegram_bot_name && (
        <TelegramBindDialog
          open={dialogs.isOpen('telegram')}
          onOpenChange={(open) =>
            open ? dialogs.open('telegram') : dialogs.close('telegram')
          }
          botName={status.telegram_bot_name as string}
          onSuccess={onUpdate}
        />
      )}
    </>
  )
}
