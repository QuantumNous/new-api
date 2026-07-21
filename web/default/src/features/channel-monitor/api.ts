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
import { api, type ApiRequestConfig } from '@/lib/api'

import type {
  ChannelMonitorApplyGroupResult,
  ChannelMonitorApiResponse,
  ChannelMonitorFetchResult,
  ChannelMonitorGroupRatioSyncResult,
  ChannelMonitorOverview,
  ChannelMonitorPerformanceRangeMinutes,
  ChannelMonitorPerformanceResult,
  ChannelMonitorSettings,
  ChannelMonitorSmartScheduleConfig,
  ChannelMonitorSuccessDetailResult,
  ChannelMonitorTaskRunResult,
  ChannelMonitorTaskPage,
  ChannelMonitorTaskKind,
  ChannelMonitorUpstreamBalanceResult,
  ChannelMonitorUpstreamConfig,
  ChannelMonitorUpstreamGroupsResult,
  ChannelMonitorUpstreamRequest,
  ChannelMonitorUpstreamVersionResult,
  ChannelRatioHistoryPage,
  NewAPIGroupRatioResult,
} from './types'

const channelMonitorRequestConfig = (
  config: ApiRequestConfig = {}
): ApiRequestConfig => ({
  ...config,
  skipBusinessError: true,
  skipErrorHandler: true,
})

function ensureChannelMonitorSuccess<T>(
  response: ChannelMonitorApiResponse<T>
) {
  if (!response.success) {
    throw new Error(response.message || '渠道监控请求失败')
  }
  return response
}

export async function getChannelMonitorOverview() {
  const response = await api.get<
    ChannelMonitorApiResponse<ChannelMonitorOverview>
  >('/api/channel_monitor/', channelMonitorRequestConfig())
  return ensureChannelMonitorSuccess(response.data)
}

export async function getChannelMonitorPerformance(
  minutes: ChannelMonitorPerformanceRangeMinutes
) {
  const response = await api.get<
    ChannelMonitorApiResponse<ChannelMonitorPerformanceResult>
  >(
    '/api/channel_monitor/performance',
    channelMonitorRequestConfig({ params: { minutes } })
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function getChannelMonitorSuccessDetail(request: {
  minutes: ChannelMonitorPerformanceRangeMinutes
  channelId?: number
  modelName?: string
  groupName?: string
}) {
  const response = await api.get<
    ChannelMonitorApiResponse<ChannelMonitorSuccessDetailResult>
  >(
    '/api/channel_monitor/success/detail',
    channelMonitorRequestConfig({
      params: {
        minutes: request.minutes,
        channel_id: request.channelId,
        model_name: request.modelName,
        group: request.groupName,
      },
    })
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function updateChannelMonitorChannelOrder(channelIds: number[]) {
  const response = await api.put<
    ChannelMonitorApiResponse<{ channel_order: number[] }>
  >(
    '/api/channel_monitor/order',
    {
      channel_ids: channelIds,
    },
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function getChannelMonitorTasks(
  page: number,
  pageSize: number,
  kind: ChannelMonitorTaskKind
) {
  const response = await api.get<
    ChannelMonitorApiResponse<ChannelMonitorTaskPage>
  >(
    '/api/channel_monitor/tasks',
    channelMonitorRequestConfig({
      params: { p: page, page_size: pageSize, kind },
    })
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function runChannelMonitorSmartSchedule() {
  const response = await api.post<
    ChannelMonitorApiResponse<ChannelMonitorTaskRunResult>
  >(
    '/api/channel_monitor/schedule/run',
    undefined,
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function runChannelMonitorRatioUpdate() {
  const response = await api.post<
    ChannelMonitorApiResponse<ChannelMonitorTaskRunResult>
  >('/api/channel_monitor/ratio/run', undefined, channelMonitorRequestConfig())
  return ensureChannelMonitorSuccess(response.data)
}

export async function updateChannelMonitorSmartScheduleConfig(request: {
  channelId: number
  excluded: boolean
  reset?: boolean
}) {
  const response = await api.put<
    ChannelMonitorApiResponse<ChannelMonitorSmartScheduleConfig>
  >(
    `/api/channel_monitor/channel/${request.channelId}/schedule`,
    {
      excluded: request.excluded,
      reset: request.reset,
    },
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function updateChannelMonitorRatio(request: {
  channelId: number
  ratio: number
  remark: string
}) {
  const response = await api.put(
    `/api/channel_monitor/channel/${request.channelId}`,
    {
      ratio: request.ratio,
      remark: request.remark,
    },
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function getChannelMonitorHistory(channelId: number) {
  const response = await api.get<
    ChannelMonitorApiResponse<ChannelRatioHistoryPage>
  >(
    `/api/channel_monitor/channel/${channelId}/history`,
    channelMonitorRequestConfig({ params: { p: 1, page_size: 100 } })
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function updateChannelMonitorGroupRatio(request: {
  group: string
  ratio: number
}) {
  const response = await api.put(
    '/api/channel_monitor/group',
    request,
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function syncChannelMonitorGroupRatio(request: {
  group: string
  coefficient: number
}) {
  const response = await api.put<
    ChannelMonitorApiResponse<ChannelMonitorGroupRatioSyncResult>
  >('/api/channel_monitor/group/sync', request, channelMonitorRequestConfig())
  return ensureChannelMonitorSuccess(response.data)
}

export async function updateChannelMonitorSettings(
  settings: ChannelMonitorSettings & {
    smart_schedule_force_reset?: boolean
  }
) {
  const response = await api.put<
    ChannelMonitorApiResponse<ChannelMonitorSettings>
  >('/api/channel_monitor/settings', settings, channelMonitorRequestConfig())
  return ensureChannelMonitorSuccess(response.data)
}

export async function getChannelMonitorAvailableGroups() {
  const response = await api.get<ChannelMonitorApiResponse<string[]>>(
    '/api/group/',
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function updateMonitoredChannelStatus(request: {
  channelId: number
  status: number
}) {
  const response = await api.post<ChannelMonitorApiResponse<boolean>>(
    `/api/channel/${request.channelId}/status`,
    { status: request.status },
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function updateMonitoredChannelGroups(request: {
  channelId: number
  groups: string[]
}) {
  const response = await api.put<ChannelMonitorApiResponse<unknown>>(
    '/api/channel/',
    { id: request.channelId, group: request.groups.join(',') },
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function saveChannelMonitorUpstreamConfig(request: {
  channelId: number
  config: ChannelMonitorUpstreamRequest
}) {
  const response = await api.put<
    ChannelMonitorApiResponse<ChannelMonitorUpstreamConfig>
  >(
    `/api/channel_monitor/channel/${request.channelId}/upstream`,
    request.config,
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function fetchChannelMonitorSub2APIUpstreamVersion(request: {
  channelId: number
  baseUrl: string
}) {
  const response = await api.post<
    ChannelMonitorApiResponse<ChannelMonitorUpstreamVersionResult>
  >(
    `/api/channel_monitor/channel/${request.channelId}/upstream/version`,
    {
      base_url: request.baseUrl,
    },
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function testChannelMonitorUpstreamConfig(request: {
  channelId: number
  config: ChannelMonitorUpstreamRequest
}) {
  const response = await api.post<
    ChannelMonitorApiResponse<NewAPIGroupRatioResult>
  >(
    `/api/channel_monitor/channel/${request.channelId}/upstream/test`,
    request.config,
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function listChannelMonitorUpstreamGroups(request: {
  channelId: number
  config: ChannelMonitorUpstreamRequest
}) {
  const response = await api.post<
    ChannelMonitorApiResponse<ChannelMonitorUpstreamGroupsResult>
  >(
    `/api/channel_monitor/channel/${request.channelId}/upstream/groups`,
    request.config,
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function fetchChannelMonitorUpstreamRatio(channelId: number) {
  const response = await api.post<
    ChannelMonitorApiResponse<ChannelMonitorFetchResult>
  >(
    `/api/channel_monitor/channel/${channelId}/upstream/fetch`,
    undefined,
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function fetchChannelMonitorUpstreamBalance(channelId: number) {
  const response = await api.post<
    ChannelMonitorApiResponse<ChannelMonitorUpstreamBalanceResult>
  >(
    `/api/channel_monitor/channel/${channelId}/upstream/balance/fetch`,
    undefined,
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}

export async function applyChannelMonitorUpstreamGroup(channelId: number) {
  const response = await api.post<
    ChannelMonitorApiResponse<ChannelMonitorApplyGroupResult>
  >(
    `/api/channel_monitor/channel/${channelId}/upstream/group/apply`,
    undefined,
    channelMonitorRequestConfig()
  )
  return ensureChannelMonitorSuccess(response.data)
}
