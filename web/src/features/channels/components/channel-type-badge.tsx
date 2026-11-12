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
import { Puzzle, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ProviderBadge } from '@/components/provider-badge'
import { StatusBadge } from '@/components/status-badge'
import { PluginIcon } from '@/features/task-plugins/components/plugin-icon'
import type { PluginIconInput } from '@/features/task-plugins/lib/plugin-icon'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { CHANNEL_TYPE_OPTIONS, CHANNEL_TYPE_TASK_PLUGIN } from '../constants'
import { useTaskPluginOption } from '../hooks/use-task-plugin-option'
import { getChannelTypeIcon } from '../lib/channel-utils'

export function ChannelTypeLogo(props: {
  type: number
  plugin?: PluginIconInput
  size?: number
  className?: string
}) {
  const size = props.size ?? 16
  if (props.type === CHANNEL_TYPE_TASK_PLUGIN && props.plugin) {
    return <PluginIcon plugin={props.plugin} size={size} />
  }
  const isKnownType = CHANNEL_TYPE_OPTIONS.some(
    (option) => option.value === props.type
  )
  if (props.type === CHANNEL_TYPE_TASK_PLUGIN || !isKnownType) {
    const Icon = props.type === CHANNEL_TYPE_TASK_PLUGIN ? Puzzle : Server
    return (
      <Icon
        className={cn('text-muted-foreground shrink-0', props.className)}
        size={size}
        aria-hidden='true'
      />
    )
  }
  return (
    <span className={cn('inline-flex shrink-0', props.className)}>
      {getLobeIcon(`${getChannelTypeIcon(props.type)}.Color`, size)}
    </span>
  )
}

export function TaskPluginChannelBadge(props: { pluginKey?: string }) {
  const { t } = useTranslation()
  const plugin = useTaskPluginOption(props.pluginKey)
  // Plugins that serve relay routes are not only task plugins.
  const kind = plugin?.provider ? t('Plugin') : t('Task Plugin')
  const label = plugin?.name || props.pluginKey || kind
  const iconInput =
    plugin ?? (props.pluginKey ? { key: props.pluginKey } : undefined)

  return (
    <div
      className='flex max-w-full min-w-0 items-center gap-1.5'
      title={
        props.pluginKey ? `${kind} · ${label} (${props.pluginKey})` : label
      }
    >
      <ProviderBadge
        iconNode={
          <ChannelTypeLogo
            type={CHANNEL_TYPE_TASK_PLUGIN}
            plugin={iconInput}
            size={18}
          />
        }
        label={label}
        colorText={false}
        copyable={false}
        showDot={false}
        className='min-w-0 overflow-hidden'
      />
      {props.pluginKey && (
        <StatusBadge
          label={kind}
          variant='neutral'
          size='sm'
          copyable={false}
          showDot={false}
          className='shrink-0 text-[10px]'
        />
      )}
    </div>
  )
}
