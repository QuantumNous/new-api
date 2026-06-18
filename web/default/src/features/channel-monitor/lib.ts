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
import dayjs from '@/lib/dayjs'
import type { StatusVariant } from '@/components/status-badge'
import type {
  ChannelMonitorBodyOverrideMode,
  ChannelMonitorProvider,
  ChannelMonitorStatus,
  UserChannelMonitor,
} from './types'

export const channelMonitorQueryKeys = {
  all: ['channel-monitors'] as const,
  list: (params: Record<string, unknown>) =>
    [...channelMonitorQueryKeys.all, 'list', params] as const,
  history: (id: number) =>
    [...channelMonitorQueryKeys.all, 'history', id] as const,
  templates: (params: Record<string, unknown> = {}) =>
    [...channelMonitorQueryKeys.all, 'templates', params] as const,
  templateAssociatedMonitors: (id: number) =>
    [...channelMonitorQueryKeys.all, 'templates', id, 'monitors'] as const,
  userStatus: ['channel-monitors', 'user-status'] as const,
  userDetail: (id: number) =>
    [...channelMonitorQueryKeys.userStatus, 'detail', id] as const,
}

export const providerOptions: Array<{
  label: string
  value: ChannelMonitorProvider
}> = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Gemini', value: 'gemini' },
]

export const apiModeOptions = [
  { label: 'Chat Completions', value: 'chat_completions' },
  { label: 'Responses', value: 'responses' },
] as const

export const bodyOverrideModeOptions: Array<{
  label: string
  value: ChannelMonitorBodyOverrideMode
}> = [
  { label: 'Off', value: 'off' },
  { label: 'Merge', value: 'merge' },
  { label: 'Replace', value: 'replace' },
]

export function getProviderLabel(provider: string) {
  return (
    providerOptions.find((item) => item.value === provider)?.label ?? provider
  )
}

export function getMonitorStatusLabel(status?: string | null) {
  switch (status) {
    case 'operational':
      return 'Operational'
    case 'degraded':
      return 'Degraded'
    case 'failed':
      return 'Failed'
    case 'error':
      return 'Error'
    case 'disabled':
      return 'Disabled'
    default:
      return 'Unknown'
  }
}

export function getMonitorStatusVariant(status?: string | null): StatusVariant {
  switch (status) {
    case 'operational':
      return 'success'
    case 'degraded':
      return 'warning'
    case 'failed':
    case 'error':
      return 'danger'
    case 'disabled':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function formatAvailability(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '-'
  return `${value.toFixed(value >= 99.95 ? 2 : 1)}%`
}

export function formatLatency(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '-'
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(2)} s`
}

export function formatMonitorTime(value?: string | null) {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

export function formatMonitorRelativeTime(value?: string | null) {
  if (!value) return '-'
  return dayjs(value).fromNow()
}

export function splitModelList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function groupUserMonitors(items: UserChannelMonitor[]) {
  return items.reduce<Record<string, UserChannelMonitor[]>>((acc, item) => {
    const group = item.group_name?.trim() || 'Default Group'
    if (!acc[group]) acc[group] = []
    acc[group].push(item)
    return acc
  }, {})
}

export function statusSegmentClassName(status: ChannelMonitorStatus | string) {
  switch (status) {
    case 'operational':
      return 'bg-success'
    case 'degraded':
      return 'bg-warning'
    case 'failed':
    case 'error':
      return 'bg-destructive'
    default:
      return 'bg-muted'
  }
}
