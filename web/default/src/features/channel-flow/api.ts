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

import { api } from '@/lib/api'
import type {
  ApiResponse,
  ChannelFlowBindingPayload,
  ChannelFlowPool,
  ChannelFlowPoolBinding,
  ChannelFlowPoolPayload,
  ChannelFlowPoolStatus,
  PageResponse,
} from './types'

const channelFlowActionConfig = {
  skipBusinessError: true,
  skipErrorHandler: true,
}

export type ListChannelFlowPoolsParams = {
  p?: number
  page_size?: number
  keyword?: string
}

export async function listChannelFlowPools(
  params: ListChannelFlowPoolsParams = {}
): Promise<ApiResponse<PageResponse<ChannelFlowPool>>> {
  const res = await api.get('/api/channel_flow/pools', { params })
  return res.data
}

export async function createChannelFlowPool(
  payload: ChannelFlowPoolPayload
): Promise<ApiResponse<ChannelFlowPool>> {
  const res = await api.post(
    '/api/channel_flow/pools',
    payload,
    channelFlowActionConfig
  )
  return res.data
}

export async function updateChannelFlowPool(
  poolId: number,
  payload: ChannelFlowPoolPayload
): Promise<ApiResponse<ChannelFlowPool>> {
  const res = await api.put(
    `/api/channel_flow/pools/${poolId}`,
    payload,
    channelFlowActionConfig
  )
  return res.data
}

export async function deleteChannelFlowPool(
  poolId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/channel_flow/pools/${poolId}`,
    channelFlowActionConfig
  )
  return res.data
}

export async function getChannelFlowPoolStatus(
  poolId: number
): Promise<ApiResponse<ChannelFlowPoolStatus>> {
  const res = await api.get(`/api/channel_flow/pools/${poolId}/status`, {
    disableDuplicate: true,
  })
  return res.data
}

export async function listChannelFlowPoolBindings(
  poolId: number
): Promise<ApiResponse<ChannelFlowPoolBinding[]>> {
  const res = await api.get(`/api/channel_flow/pools/${poolId}/bindings`)
  return res.data
}

export async function createChannelFlowPoolBinding(
  poolId: number,
  payload: ChannelFlowBindingPayload
): Promise<ApiResponse<ChannelFlowPoolBinding>> {
  const res = await api.post(
    `/api/channel_flow/pools/${poolId}/bindings`,
    payload,
    channelFlowActionConfig
  )
  return res.data
}

export async function deleteChannelFlowPoolBinding(
  bindingId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/channel_flow/bindings/${bindingId}`,
    channelFlowActionConfig
  )
  return res.data
}

