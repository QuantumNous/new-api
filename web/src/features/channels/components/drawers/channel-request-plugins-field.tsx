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
import { useQuery } from '@tanstack/react-query'
import { Reorder } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { AutoGroupOrderItem } from '@/components/auto-group-order-item'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import {
  listRequestPluginInstances,
  listRequestPluginOptions,
} from '@/features/task-plugins/api'
import { PluginIcon } from '@/features/task-plugins/components/plugin-icon'
import { localizedPluginName } from '@/features/task-plugins/lib/plugin-name'
import {
  REQUEST_PLUGIN_INSTANCES_QUERY_KEY,
  REQUEST_PLUGIN_OPTIONS_QUERY_KEY,
} from '@/features/task-plugins/lib/request-plugins'

type ChannelRequestPluginsFieldProps = {
  id?: string
  /** Instance ids, in the order they run for this channel. */
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  'aria-describedby'?: string
}

/** The request processing instances a channel adds, as an ordered list. */
export function ChannelRequestPluginsField(
  props: ChannelRequestPluginsFieldProps
) {
  const { t, i18n } = useTranslation()
  const instancesQuery = useQuery({
    queryKey: REQUEST_PLUGIN_INSTANCES_QUERY_KEY,
    queryFn: listRequestPluginInstances,
    meta: { errorToast: false },
  })
  const pluginsQuery = useQuery({
    queryKey: REQUEST_PLUGIN_OPTIONS_QUERY_KEY,
    queryFn: listRequestPluginOptions,
    meta: { errorToast: false },
  })
  const instances = instancesQuery.data ?? []
  const plugins = pluginsQuery.data ?? []
  const pluginIcon = (pluginKey: string) => (
    <PluginIcon
      plugin={
        plugins.find((plugin) => plugin.key === pluginKey) ?? { key: pluginKey }
      }
      size={16}
    />
  )
  const candidates = instances.filter(
    (instance) => !props.value.includes(instance.id)
  )
  let placeholder = t('Add an instance')
  if (instancesQuery.isPending) placeholder = t('Loading...')
  else if (instancesQuery.isError) {
    placeholder = t('Instances could not be loaded')
  }

  const move = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= props.value.length) return
    const next = [...props.value]
    ;[next[index], next[target]] = [next[target], next[index]]
    props.onChange(next)
  }

  return (
    <div
      id={props.id}
      role='group'
      aria-label={t('Request processing plugins')}
      aria-describedby={props['aria-describedby']}
      className='flex flex-col gap-3'
    >
      <Combobox
        aria-label={t('Add an instance')}
        options={candidates.map((instance) => {
          const plugin = plugins.find((item) => item.key === instance.plugin)
          return {
            value: instance.id,
            label: instance.name,
            description: plugin
              ? localizedPluginName(plugin, i18n.language)
              : instance.plugin,
            icon: pluginIcon(instance.plugin),
          }
        })}
        value=''
        onValueChange={(id) => {
          if (!id || props.value.includes(id)) return
          props.onChange([...props.value, id])
        }}
        placeholder={placeholder}
        emptyText={t('No more instances')}
        disabled={props.disabled || !instancesQuery.isSuccess}
      />
      {props.value.length > 0 && (
        <Reorder.Group
          axis='y'
          values={props.value}
          onReorder={(next: string[]) => {
            if (!props.disabled) props.onChange(next)
          }}
          className='flex flex-col gap-2'
        >
          {props.value.map((id, index) => {
            const instance = instances.find((item) => item.id === id)
            const deleted = instancesQuery.isSuccess && !instance
            return (
              <AutoGroupOrderItem
                key={id}
                group={instance?.name ?? id}
                value={id}
                index={index}
                count={props.value.length}
                leading={instance ? pluginIcon(instance.plugin) : undefined}
                onMove={move}
                onRemove={(removed) =>
                  props.onChange(props.value.filter((item) => item !== removed))
                }
              >
                {deleted && (
                  <Badge variant='destructive'>
                    {t('Deleted', { context: 'instance' })}
                  </Badge>
                )}
                {instance && !instance.enabled && (
                  <Badge variant='secondary'>{t('Disabled')}</Badge>
                )}
              </AutoGroupOrderItem>
            )
          })}
        </Reorder.Group>
      )}
    </div>
  )
}
