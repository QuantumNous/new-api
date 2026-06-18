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
  AssociatedMonitorsData,
  ApiResponse,
  ChannelMonitor,
  ChannelMonitorHistoryData,
  ChannelMonitorListData,
  ChannelMonitorListParams,
  ChannelMonitorPayload,
  ChannelMonitorRunResult,
  ChannelMonitorTemplate,
  ChannelMonitorTemplateListData,
  ChannelMonitorTemplateListParams,
  ChannelMonitorTemplatePayload,
  ChannelMonitorTemplateUpdatePayload,
  ChannelMonitorUpdatePayload,
  UserChannelMonitorDetailData,
  UserChannelMonitorStatusData,
} from './types'

const monitorActionConfig = (
  config: ApiRequestConfig = {}
): ApiRequestConfig => ({
  ...config,
  skipBusinessError: true,
})

export async function getChannelMonitors(params: ChannelMonitorListParams) {
  const res = await api.get<ApiResponse<ChannelMonitorListData>>(
    '/api/channel_monitor',
    { params }
  )
  return res.data
}

export async function getChannelMonitor(id: number) {
  const res = await api.get<ApiResponse<ChannelMonitor>>(
    `/api/channel_monitor/${id}`
  )
  return res.data
}

export async function createChannelMonitor(payload: ChannelMonitorPayload) {
  const res = await api.post<ApiResponse<ChannelMonitor>>(
    '/api/channel_monitor',
    payload,
    monitorActionConfig()
  )
  return res.data
}

export async function updateChannelMonitor(
  id: number,
  payload: ChannelMonitorUpdatePayload
) {
  const res = await api.put<ApiResponse<ChannelMonitor>>(
    `/api/channel_monitor/${id}`,
    payload,
    monitorActionConfig()
  )
  return res.data
}

export async function deleteChannelMonitor(id: number) {
  const res = await api.delete<ApiResponse<null>>(
    `/api/channel_monitor/${id}`,
    monitorActionConfig()
  )
  return res.data
}

export async function runChannelMonitor(id: number) {
  const res = await api.post<ApiResponse<ChannelMonitorRunResult[]>>(
    `/api/channel_monitor/${id}/run`,
    null,
    monitorActionConfig()
  )
  return res.data
}

export async function getChannelMonitorHistory(
  id: number,
  params: { model?: string; limit?: number } = {}
) {
  const res = await api.get<ApiResponse<ChannelMonitorHistoryData>>(
    `/api/channel_monitor/${id}/history`,
    { params }
  )
  return res.data
}

export async function getUserChannelMonitorStatus() {
  const res = await api.get<ApiResponse<UserChannelMonitorStatusData>>(
    '/api/channel_monitor/status',
    { disableDuplicate: true }
  )
  return res.data
}

export async function getUserChannelMonitorDetail(id: number) {
  const res = await api.get<ApiResponse<UserChannelMonitorDetailData>>(
    `/api/channel_monitor/${id}/status`,
    { disableDuplicate: true }
  )
  return res.data
}

export async function getChannelMonitorTemplates(
  params: ChannelMonitorTemplateListParams = {}
) {
  const res = await api.get<ApiResponse<ChannelMonitorTemplateListData>>(
    '/api/channel_monitor_template',
    { params }
  )
  return res.data
}

export async function getChannelMonitorTemplate(id: number) {
  const res = await api.get<ApiResponse<ChannelMonitorTemplate>>(
    `/api/channel_monitor_template/${id}`
  )
  return res.data
}

export async function createChannelMonitorTemplate(
  payload: ChannelMonitorTemplatePayload
) {
  const res = await api.post<ApiResponse<ChannelMonitorTemplate>>(
    '/api/channel_monitor_template',
    payload,
    monitorActionConfig()
  )
  return res.data
}

export async function updateChannelMonitorTemplate(
  id: number,
  payload: ChannelMonitorTemplateUpdatePayload
) {
  const res = await api.put<ApiResponse<ChannelMonitorTemplate>>(
    `/api/channel_monitor_template/${id}`,
    payload,
    monitorActionConfig()
  )
  return res.data
}

export async function deleteChannelMonitorTemplate(id: number) {
  const res = await api.delete<ApiResponse<null>>(
    `/api/channel_monitor_template/${id}`,
    monitorActionConfig()
  )
  return res.data
}

export async function applyChannelMonitorTemplate(
  id: number,
  monitorIds: number[]
) {
  const res = await api.post<ApiResponse<{ affected: number }>>(
    `/api/channel_monitor_template/${id}/apply`,
    { monitor_ids: monitorIds },
    monitorActionConfig()
  )
  return res.data
}

export async function getChannelMonitorTemplateAssociatedMonitors(id: number) {
  const res = await api.get<ApiResponse<AssociatedMonitorsData>>(
    `/api/channel_monitor_template/${id}/monitors`
  )
  return res.data
}
