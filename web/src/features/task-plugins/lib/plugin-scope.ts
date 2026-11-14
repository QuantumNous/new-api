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
import type { TaskPluginOption } from '@/features/channels/api'

import type { RequestPluginInstance, RequestPluginScope } from '../types'

/** The scope a plugin declares now, as an instance confirms it; null for none. */
export function declaredPluginScope(
  plugin: Pick<TaskPluginOption, 'scope'> | undefined
): RequestPluginScope | null {
  const scope = plugin?.scope
  if (!scope) return null
  const models = scope.models ?? []
  const channelTypes = scope.channelTypes ?? []
  if (models.length === 0 && channelTypes.length === 0) return null
  return { models: [...models], channel_types: [...channelTypes] }
}

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item))
}

/** Whether two scopes hold the same models and channel types, in any order. */
export function samePluginScope(
  a: RequestPluginScope,
  b: RequestPluginScope
): boolean {
  return (
    sameItems(a.models, b.models) && sameItems(a.channel_types, b.channel_types)
  )
}

/**
 * Whether an instance that follows its plugin's scope confirmed an older
 * one: the plugin changed where it runs, and the change waits for review.
 * False for an instance placed by hand or a plugin that is gone.
 */
export function pluginScopeNeedsReview(
  instance: RequestPluginInstance,
  plugin: TaskPluginOption | undefined
): boolean {
  if (!instance.plugin_scope || !plugin) return false
  const declared = declaredPluginScope(plugin)
  return !declared || !samePluginScope(instance.plugin_scope, declared)
}
