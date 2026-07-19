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
import { CHANNEL_STATUS } from '@/features/channels/constants'

import type {
  ChannelMonitorChannelPerformance,
  ChannelMonitorItem,
  ChannelMonitorSortMode,
} from '../types'

function compareChannelEnabledStatus(
  first: ChannelMonitorItem,
  second: ChannelMonitorItem
) {
  const firstEnabled = first.status === CHANNEL_STATUS.ENABLED
  const secondEnabled = second.status === CHANNEL_STATUS.ENABLED
  if (firstEnabled === secondEnabled) return 0
  return firstEnabled ? -1 : 1
}

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
  channelOrder: number[],
  performanceByChannel: ReadonlyMap<number, ChannelMonitorChannelPerformance>
) {
  if (sortMode === 'custom') {
    return orderChannelsByCustomOrder(channels, channelOrder).sort(
      compareChannelEnabledStatus
    )
  }

  return [...channels].sort((first, second) => {
    const statusComparison = compareChannelEnabledStatus(first, second)
    if (statusComparison !== 0) return statusComparison

    if (sortMode === 'channel_asc' || sortMode === 'channel_desc') {
      const comparison = compareChannelNames(first, second)
      return sortMode === 'channel_asc' ? comparison : -comparison
    }

    if (sortMode === 'ratio_asc' || sortMode === 'ratio_desc') {
      if (first.cost_ratio == null && second.cost_ratio == null) {
        return compareChannelNames(first, second)
      }
      if (first.cost_ratio == null) return 1
      if (second.cost_ratio == null) return -1
      const ratioComparison = first.cost_ratio - second.cost_ratio
      if (ratioComparison !== 0) {
        return sortMode === 'ratio_asc' ? ratioComparison : -ratioComparison
      }
      return compareChannelNames(first, second)
    }

    const firstPerformance = performanceByChannel.get(first.id)
    const secondPerformance = performanceByChannel.get(second.id)
    const firstTokenSort =
      sortMode === 'first_token_asc' || sortMode === 'first_token_desc'
    const firstValue = firstTokenSort
      ? firstPerformance?.average_first_token_ms
      : firstPerformance?.average_tps
    const secondValue = firstTokenSort
      ? secondPerformance?.average_first_token_ms
      : secondPerformance?.average_tps
    if (firstValue == null && secondValue == null) {
      return compareChannelNames(first, second)
    }
    if (firstValue == null) return 1
    if (secondValue == null) return -1
    const performanceComparison = firstValue - secondValue
    if (performanceComparison !== 0) {
      const ascending = sortMode === 'first_token_asc' || sortMode === 'tps_asc'
      return ascending ? performanceComparison : -performanceComparison
    }
    return compareChannelNames(first, second)
  })
}
