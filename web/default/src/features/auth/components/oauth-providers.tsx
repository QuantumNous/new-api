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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IconDiscord,
  IconGithub,
  IconLinuxDo,
  IconWeChat,
} from '@/assets/brand-icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useOAuthLogin } from '../hooks/use-oauth-login'
import type { SystemStatus } from '../types'

type OAuthProvidersProps = {
  status: SystemStatus | null
  disabled?: boolean
  className?: string
  onWeChatLogin?: () => void
  isWeChatLoading?: boolean
}

type ProviderButton = {
  key: string
  label: string
  onClick: () => void
  icon?: ReactNode
  disabled?: boolean
}

function GoogleLogoColored(props: { className?: string }) {
  return (
    <svg fill='none' viewBox='0 0 24 24' {...props}>
      <g clipPath='url(#google-logo-colored-clip)'>
        <path
          fill='#FBBC05'
          d='M5.6 12q0-1.05.33-2l-3.7-2.76a10.6 10.6 0 0 0 0 9.52L5.93 14A6 6 0 0 1 5.6 12'
        />
        <path
          fill='#EA4335'
          d='M12.1 5.64c1.55 0 2.95.54 4.05 1.42l3.2-3.13a11 11 0 0 0-7.25-2.69 11 11 0 0 0-9.87 6L5.93 10a6.5 6.5 0 0 1 6.17-4.36'
        />
        <path
          fill='#34A853'
          d='M12.1 18.36A6.5 6.5 0 0 1 5.93 14l-3.7 2.76a11 11 0 0 0 9.87 6c2.68 0 5.24-.94 7.17-2.69l-3.52-2.66c-.99.62-2.24.95-3.65.95'
        />
        <path
          fill='#4285F4'
          d='M22.6 12q-.01-.98-.25-1.96H12.1v4.16H18a4.8 4.8 0 0 1-2.25 3.21l3.52 2.66c2.02-1.83 3.33-4.56 3.33-8.07'
        />
      </g>
      <defs>
        <clipPath id='google-logo-colored-clip'>
          <path fill='#fff' d='M0 0H22V22H0z' transform='translate(1 1)' />
        </clipPath>
      </defs>
    </svg>
  )
}

export function OAuthProviders({
  status,
  disabled = false,
  className,
  onWeChatLogin,
  isWeChatLoading = false,
}: OAuthProvidersProps) {
  const { t } = useTranslation()
  const {
    isLoading,
    githubButtonText,
    githubButtonDisabled,
    handleGitHubLogin,
    handleDiscordLogin,
    handleGoogleLogin,
    handleOIDCLogin,
    handleLinuxDOLogin,
    handleTelegramLogin,
    handleCustomOAuthLogin,
  } = useOAuthLogin(status)

  const providerButtons: ProviderButton[] = []

  if (status?.wechat_login && onWeChatLogin) {
    providerButtons.push({
      key: 'wechat',
      label: t('Continue with WeChat'),
      onClick: onWeChatLogin,
      icon: <IconWeChat className='h-4 w-4' />,
      disabled: isWeChatLoading,
    })
  }

  if (status?.github_oauth) {
    providerButtons.push({
      key: 'github',
      label: githubButtonText || t('Continue with GitHub'),
      onClick: handleGitHubLogin,
      icon: <IconGithub className='h-4 w-4' />,
      disabled: githubButtonDisabled,
    })
  }

  if (status?.discord_oauth) {
    providerButtons.push({
      key: 'discord',
      label: t('Continue with Discord'),
      onClick: handleDiscordLogin,
      icon: <IconDiscord className='h-4 w-4' />,
    })
  }

  if (status?.google_oauth) {
    providerButtons.push({
      key: 'google',
      label: t('Continue with Google'),
      onClick: handleGoogleLogin,
      icon: <GoogleLogoColored className='h-4 w-4' />,
    })
  }

  if (status?.oidc_enabled) {
    providerButtons.push({
      key: 'oidc',
      label: t('Continue with OIDC'),
      onClick: handleOIDCLogin,
    })
  }

  if (status?.linuxdo_oauth) {
    providerButtons.push({
      key: 'linuxdo',
      label: t('Continue with LinuxDO'),
      onClick: handleLinuxDOLogin,
      icon: <IconLinuxDo className='h-4 w-4' />,
    })
  }

  if (status?.telegram_oauth) {
    providerButtons.push({
      key: 'telegram',
      label: t('Continue with Telegram'),
      onClick: handleTelegramLogin,
    })
  }

  // Custom OAuth providers
  const customProviders = status?.custom_oauth_providers
  if (customProviders && customProviders.length > 0) {
    for (const provider of customProviders) {
      providerButtons.push({
        key: `custom-${provider.slug}`,
        label: t('Continue with {{name}}', { name: provider.name }),
        onClick: () => handleCustomOAuthLogin(provider),
      })
    }
  }

  if (providerButtons.length === 0) return null

  return (
    <div className={cn('space-y-3', className)}>
      <div className='flex flex-col gap-2'>
        {providerButtons.map(
          ({ key, label, onClick, icon, disabled: extraDisabled }) => (
            <Button
              key={key}
              variant='outline'
              type='button'
              disabled={disabled || isLoading || extraDisabled}
              onClick={onClick}
              className={cn(
                'h-11 w-full justify-center gap-2 rounded-lg',
                key === 'google' && 'mb-[5px]'
              )}
            >
              {icon}
              {label}
            </Button>
          )
        )}
      </div>

      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-background text-muted-foreground px-2'>
            {t('Or continue with')}
          </span>
        </div>
      </div>
    </div>
  )
}
