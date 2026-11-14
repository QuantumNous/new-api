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
import { useTranslation } from 'react-i18next'

import { ChannelTypeLogo } from '@/features/channels/components/channel-type-badge'
import { getChannelTypeLabel } from '@/features/channels/lib'
import { getLobeIcon } from '@/lib/lobe-icon'
import { resolveModelProvider } from '@/lib/model-provider'
import { cn } from '@/lib/utils'

import type { RequestPluginScope } from '../types'

/** One labeled line of the scope: icons and names, wrapping. */
function ScopeLine(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
      <span className='text-muted-foreground shrink-0'>{props.label}</span>
      {props.children}
    </div>
  )
}

/**
 * The models and channel types a plugin is made for. A side the scope
 * leaves open reads as all models or all channels.
 */
export function PluginScopeSummary(props: {
  scope: RequestPluginScope
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('space-y-1.5 text-sm', props.className)}>
      <ScopeLine label={t('Channels')}>
        {props.scope.channel_types.length === 0 ? (
          <span>{t('All channels')}</span>
        ) : (
          props.scope.channel_types.map((type) => (
            <span key={type} className='inline-flex items-center gap-1.5'>
              <ChannelTypeLogo type={type} size={16} />
              {t(getChannelTypeLabel(type))}
            </span>
          ))
        )}
      </ScopeLine>
      <ScopeLine label={t('Models')}>
        {props.scope.models.length === 0 ? (
          <span>{t('All models')}</span>
        ) : (
          props.scope.models.map((model) => {
            const provider = resolveModelProvider(model)
            return (
              <span key={model} className='inline-flex items-center gap-1.5'>
                {provider && (
                  <span aria-hidden='true' className='inline-flex'>
                    {getLobeIcon(provider.icon, 16)}
                  </span>
                )}
                {model}
              </span>
            )
          })
        )}
      </ScopeLine>
    </div>
  )
}
