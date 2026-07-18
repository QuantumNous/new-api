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
import type { ChannelMonitorItem, ChannelMonitorSortMode } from '../types'

function compareChannelNames(
  first: ChannelMonitorItem,
  second: ChannelMonitorItem
) {
  const nameComparison = first.name.localeCompare(second.name, 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  })
  return nameComparison || first.id - second.id
}

export function orderChannelsByCustomOrder(
  channels: ChannelMonitorItem[],
  channelOrder: number[]
) {
  const channelById = new Map(channels.map((channel) => [channel.id, channel]))
  const orderedChannels: ChannelMonitorItem[] = []
  for (const channelId of channelOrder) {
    const channel = channelById.get(channelId)
    if (!channel) continue
    orderedChannels.push(channel)
    channelById.delete(channelId)
  }
  for (const channel of channels) {
    if (channelById.has(channel.id)) orderedChannels.push(channel)
  }
  return orderedChannels
}

export function sortChannelMonitorItems(
  channels: ChannelMonitorItem[],
  sortMode: ChannelMonitorSortMode,
  channelOrder: number[]
) {
  if (sortMode === 'custom') {
    return orderChannelsByCustomOrder(channels, channelOrder)
  }

  return [...channels].sort((first, second) => {
    if (sortMode === 'channel_asc' || sortMode === 'channel_desc') {
      const comparison = compareChannelNames(first, second)
      return sortMode === 'channel_asc' ? comparison : -comparison
    }

    if (first.ratio == null && second.ratio == null) {
      return compareChannelNames(first, second)
    }
    if (first.ratio == null) return 1
    if (second.ratio == null) return -1
    const ratioComparison = first.ratio - second.ratio
    if (ratioComparison !== 0) {
      return sortMode === 'ratio_asc' ? ratioComparison : -ratioComparison
    }
    return compareChannelNames(first, second)
  })
}
