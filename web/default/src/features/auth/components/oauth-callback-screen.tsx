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
import { Loader2, Send, Shield, UserRound, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { IconGithub, IconLinuxDo, IconWeChat } from '@/assets/brand-icons'

import { AuthLayout } from '../auth-layout'

type OAuthCallbackScreenProps = {
  provider: string
  mode: 'login' | 'bind'
}

type ProviderMeta = {
  label: string
  Icon: LucideIcon | ((props: { className?: string }) => React.JSX.Element)
}

const providerDictionary: Record<string, ProviderMeta> = {
  github: {
    label: 'GitHub',
    Icon: (props: { className?: string }) => (
      <IconGithub className={props.className} />
    ),
  },
  oidc: { label: 'OIDC', Icon: Shield },
  linuxdo: {
    label: 'LinuxDO',
    Icon: (props: { className?: string }) => (
      <IconLinuxDo className={props.className} />
    ),
  },
  telegram: { label: 'Telegram', Icon: Send },
  wechat: {
    label: 'WeChat',
    Icon: (props: { className?: string }) => (
      <IconWeChat className={props.className} />
    ),
  },
}

export function OAuthCallbackScreen(props: OAuthCallbackScreenProps) {
  const { t } = useTranslation()
  const { label, Icon } = useMemo(() => {
    const normalized = props.provider?.toLowerCase() ?? ''
    return (
      providerDictionary[normalized] || {
        label: 'account',
        Icon: UserRound,
      }
    )
  }, [props.provider])

  const providerLabel = t(label)
  const isBindMode = props.mode === 'bind'

  const headline = isBindMode
    ? t('Binding your {{provider}} account', { provider: providerLabel })
    : t('Signing you in with {{provider}}', { provider: providerLabel })

  const description = isBindMode
    ? t('Hang tight while we securely link this account to your profile.')
    : t('Hang tight while we finish connecting your account.')

  const secondaryNote = isBindMode
    ? t(
        'You can close this tab once the binding completes or a success message appears in the original window.'
      )
    : t(
        "You'll be redirected automatically. You can return to the previous page if nothing happens after a few seconds."
      )

  return (
    <AuthLayout
      icon={
        <div className='bg-muted flex h-12 w-12 items-center justify-center rounded-full'>
          <Icon className='h-6 w-6' />
        </div>
      }
      title={headline}
      description={description}
    >
      <div className='space-y-4 text-center'>
        <div className='flex items-center justify-center gap-2 text-sm font-medium'>
          <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
          <span>{t('Processing OAuth response...')}</span>
        </div>
        <p className='text-muted-foreground text-sm text-balance'>
          {secondaryNote}
        </p>
        <p className='text-muted-foreground text-xs text-balance'>
          {t(
            'This may take a few moments while we validate the request and update your session.'
          )}
        </p>
      </div>
    </AuthLayout>
  )
}
