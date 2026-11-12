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

import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { getTaskPluginOptions } from '../api'
import { CHANNEL_TYPE_TASK_PLUGIN, MODEL_FETCHABLE_TYPES } from '../constants'
import { parseChannelSettings } from '../lib/channel-utils'
import type { Channel } from '../types'

/** Whether the user may read the plugin options, which only binding needs. */
function useCanBindTaskPlugins() {
  const user = useAuthStore((s) => s.auth.user)
  return hasPermission(
    user,
    ADMIN_PERMISSION_RESOURCES.TASK_PLUGIN,
    ADMIN_PERMISSION_ACTIONS.BIND
  )
}

/**
 * The plugin option for a plugin key, from the plugin options the channel
 * pages share. Undefined without a key or without the bind permission.
 */
export function useTaskPluginOption(pluginKey?: string) {
  const canBind = useCanBindTaskPlugins()
  const query = useQuery({
    queryKey: ['task-plugin-options'],
    queryFn: async () => requireServerSuccess(await getTaskPluginOptions()),
    enabled: Boolean(pluginKey) && canBind,
    staleTime: 60 * 1000,
  })
  return query.data?.find((item) => item.key === pluginKey)
}

/**
 * Whether a saved channel can list its upstream models: a fetchable channel
 * type, or a plugin channel whose plugin has relay routes. Without the bind
 * permission a plugin's routes are unknown, so the action stays and the
 * server answers whether the plugin can list models.
 */
export function useChannelModelFetchable(
  channel: Pick<Channel, 'type' | 'setting'>
) {
  const canBind = useCanBindTaskPlugins()
  const pluginKey =
    channel.type === CHANNEL_TYPE_TASK_PLUGIN
      ? parseChannelSettings(channel.setting)?.task_plugin_key
      : undefined
  const plugin = useTaskPluginOption(pluginKey)
  if (MODEL_FETCHABLE_TYPES.has(channel.type)) return true
  if (!pluginKey) return false
  return !canBind || plugin?.provider === true
}

/**
 * Whether a channel's balance can be queried: always for a built-in channel
 * type, which the server answers for, and for a plugin channel only when its
 * plugin can query one. Without the bind permission the plugin's abilities
 * are unknown, so the action stays and the server answers.
 */
export function useChannelBalanceQueryable(
  channel: Pick<Channel, 'type' | 'setting'>
) {
  const canBind = useCanBindTaskPlugins()
  const pluginKey =
    channel.type === CHANNEL_TYPE_TASK_PLUGIN
      ? parseChannelSettings(channel.setting)?.task_plugin_key
      : undefined
  const plugin = useTaskPluginOption(pluginKey)
  return (
    channel.type !== CHANNEL_TYPE_TASK_PLUGIN ||
    !canBind ||
    plugin?.balance === true
  )
}
