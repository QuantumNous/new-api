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
import { api } from '@/lib/http-client'

import type {
  ApiResponse,
  ChannelContribution,
  ChannelContributionAdminSettings,
  ChannelContributionConfig,
  ChannelContributionFetchModelsResult,
  ChannelContributionList,
  ChannelContributionPayload,
  ChannelContributionRewardSummary,
  ChannelContributionRewardTransfer,
  ChannelContributionRewardTransferList,
  ChannelContributionSubmitPayload,
  ChannelContributionTestRun,
} from './types'

const basePath = '/api/channel-contributions'

export async function getChannelContributionConfig(): Promise<
  ApiResponse<ChannelContributionConfig>
> {
  const response = await api.get<ApiResponse<ChannelContributionConfig>>(
    `${basePath}/config`
  )
  return response.data
}

export async function getChannelContributions(params?: {
  page?: number
  page_size?: number
  status?: string
}): Promise<ApiResponse<ChannelContributionList | ChannelContribution[]>> {
  const query = params
    ? { p: params.page, page_size: params.page_size, status: params.status }
    : undefined
  const response = await api.get<
    ApiResponse<ChannelContributionList | ChannelContribution[]>
  >(basePath, { params: query, disableDuplicate: true })
  return response.data
}

export async function getChannelContribution(
  id: number
): Promise<ApiResponse<ChannelContribution>> {
  const response = await api.get<ApiResponse<ChannelContribution>>(
    `${basePath}/${id}`,
    { disableDuplicate: true }
  )
  return response.data
}

export async function createChannelContribution(
  payload: ChannelContributionPayload
): Promise<ApiResponse<ChannelContribution>> {
  const response = await api.post<ApiResponse<ChannelContribution>>(
    basePath,
    payload
  )
  return response.data
}

export async function updateChannelContribution(
  id: number,
  payload: ChannelContributionPayload
): Promise<ApiResponse<ChannelContribution>> {
  const response = await api.put<ApiResponse<ChannelContribution>>(
    `${basePath}/${id}`,
    payload
  )
  return response.data
}

export async function fetchChannelContributionModels(
  id: number
): Promise<ApiResponse<ChannelContributionFetchModelsResult | string[]>> {
  const response = await api.post<
    ApiResponse<ChannelContributionFetchModelsResult | string[]>
  >(`${basePath}/${id}/fetch-models`)
  return response.data
}

export async function createChannelContributionTestRun(
  id: number
): Promise<ApiResponse<ChannelContributionTestRun>> {
  const response = await api.post<ApiResponse<ChannelContributionTestRun>>(
    `${basePath}/${id}/test-runs`
  )
  return response.data
}

export async function getChannelContributionTestRun(
  id: number,
  runId: number | string
): Promise<ApiResponse<ChannelContributionTestRun>> {
  const response = await api.get<ApiResponse<ChannelContributionTestRun>>(
    `${basePath}/${id}/test-runs/${encodeURIComponent(runId)}`,
    { disableDuplicate: true }
  )
  return response.data
}

export async function submitChannelContribution(
  id: number,
  payload: ChannelContributionSubmitPayload,
  turnstile?: string
): Promise<ApiResponse<ChannelContribution>> {
  const response = await api.post<ApiResponse<ChannelContribution>>(
    `${basePath}/${id}/submit`,
    payload,
    { params: turnstile ? { turnstile } : undefined }
  )
  return response.data
}

export async function withdrawChannelContribution(
  id: number
): Promise<ApiResponse<ChannelContribution>> {
  const response = await api.post<ApiResponse<ChannelContribution>>(
    `${basePath}/${id}/withdraw`
  )
  return response.data
}

export async function getChannelContributionRewards(params?: {
  page?: number
  page_size?: number
}): Promise<ApiResponse<ChannelContributionRewardSummary>> {
  const query = params
    ? { p: params.page, page_size: params.page_size }
    : undefined
  const response = await api.get<ApiResponse<ChannelContributionRewardSummary>>(
    `${basePath}/rewards`,
    { params: query, disableDuplicate: true }
  )
  return response.data
}

export async function getChannelContributionRewardTransfers(params?: {
  page?: number
  page_size?: number
}): Promise<ApiResponse<ChannelContributionRewardTransferList>> {
  const query = params
    ? { p: params.page, page_size: params.page_size }
    : undefined
  const response = await api.get<
    ApiResponse<ChannelContributionRewardTransferList>
  >(`${basePath}/reward-transfers`, {
    params: query,
    disableDuplicate: true,
  })
  return response.data
}

export async function createChannelContributionRewardTransfer(
  amount: number
): Promise<ApiResponse<ChannelContributionRewardTransfer>> {
  const response = await api.post<
    ApiResponse<ChannelContributionRewardTransfer>
  >(`${basePath}/reward-transfers`, { amount })
  return response.data
}

export async function getAdminChannelContributions(params?: {
  page?: number
  page_size?: number
  status?: string
}): Promise<ApiResponse<ChannelContributionList | ChannelContribution[]>> {
  const query = params
    ? { p: params.page, page_size: params.page_size, status: params.status }
    : undefined
  const response = await api.get<
    ApiResponse<ChannelContributionList | ChannelContribution[]>
  >(`${basePath}/admin`, { params: query, disableDuplicate: true })
  return response.data
}

export async function getAdminChannelContribution(
  id: number
): Promise<ApiResponse<ChannelContribution>> {
  const response = await api.get<ApiResponse<ChannelContribution>>(
    `${basePath}/admin/${id}`,
    { disableDuplicate: true }
  )
  return response.data
}

export async function createAdminChannelContributionTestRun(
  id: number
): Promise<ApiResponse<ChannelContributionTestRun>> {
  const response = await api.post<ApiResponse<ChannelContributionTestRun>>(
    `${basePath}/admin/${id}/test-runs`
  )
  return response.data
}

export async function approveChannelContribution(
  id: number,
  testRunId: number | string
): Promise<ApiResponse<ChannelContribution>> {
  const response = await api.post<ApiResponse<ChannelContribution>>(
    `${basePath}/admin/${id}/approve`,
    { test_run_id: testRunId }
  )
  return response.data
}

export async function rejectChannelContribution(
  id: number,
  reason: string
): Promise<ApiResponse<ChannelContribution>> {
  const response = await api.post<ApiResponse<ChannelContribution>>(
    `${basePath}/admin/${id}/reject`,
    { reason }
  )
  return response.data
}

export async function deleteAdminChannelContribution(
  id: number
): Promise<ApiResponse> {
  const response = await api.delete<ApiResponse>(`${basePath}/admin/${id}`)
  return response.data
}

export async function getChannelContributionAdminSettings(): Promise<
  ApiResponse<ChannelContributionAdminSettings>
> {
  const response = await api.get<ApiResponse<ChannelContributionAdminSettings>>(
    `${basePath}/admin/settings`
  )
  return response.data
}

export async function updateChannelContributionAdminSettings(
  payload: ChannelContributionAdminSettings
): Promise<ApiResponse<ChannelContributionAdminSettings>> {
  const response = await api.put<ApiResponse<ChannelContributionAdminSettings>>(
    `${basePath}/admin/settings`,
    payload
  )
  return response.data
}
