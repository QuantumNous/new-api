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
import type { TaskPluginOption } from '../api'
import { CHANNEL_TYPE_OPTIONS, CHANNEL_TYPE_TASK_PLUGIN } from '../constants'

// These task-only legacy types are replaced by plugins, not extended by them.
export const LEGACY_TASK_PLUGIN_KEYS: Readonly<
  Partial<Record<number, string>>
> = {
  36: 'sunoapi',
  50: 'kling',
  51: 'jimeng',
  52: 'vidu',
  54: 'doubao',
  55: 'sora',
}

export function supportsChannelPluginExtensions(channelType: number): boolean {
  return (
    channelType !== CHANNEL_TYPE_TASK_PLUGIN &&
    !LEGACY_TASK_PLUGIN_KEYS[channelType] &&
    CHANNEL_TYPE_OPTIONS.some((option) => option.value === channelType)
  )
}

export function getChannelPluginExtensions(
  channelType: number,
  plugins: TaskPluginOption[]
): TaskPluginOption[] {
  if (!supportsChannelPluginExtensions(channelType)) return []
  return plugins.filter((plugin) => plugin.channelTypes?.includes(channelType))
}
