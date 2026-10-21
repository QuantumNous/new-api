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
  ConfirmPaymentComplianceResponse,
  PaymentConfig,
  PaymentConfigProvider,
  PaymentConfigResponse,
  PaymentConfigsResponse,
  FetchUpstreamRatiosRequest,
  LogCleanupTask,
  SystemOptionsResponse,
  SystemTaskListResponse,
  SystemTaskFilters,
  SystemTaskResponse,
  UpdateOptionRequest,
  UpdateOptionResponse,
  UpdatePasskeyDomainsRequest,
  UpdatePasskeyDomainsResponse,
  UpstreamChannelsResponse,
  UpstreamRatiosResponse,
  VendorPricingOverridesResponse,
  VendorPricingSyncRequest,
  VendorPricingSyncResponse,
} from './types'

export async function getSystemOptions() {
  const res = await api.get<SystemOptionsResponse>('/api/option/')
  return res.data
}

export async function updateSystemOption(request: UpdateOptionRequest) {
  const res = await api.put<UpdateOptionResponse>('/api/option/', request)
  return res.data
}

export async function updatePasskeyDomains(
  request: UpdatePasskeyDomainsRequest
) {
  const res = await api.put<UpdatePasskeyDomainsResponse>(
    '/api/option/passkey/domains',
    request,
    {
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 409,
    }
  )
  return res.data
}

export async function confirmPaymentCompliance() {
  const res = await api.post<ConfirmPaymentComplianceResponse>(
    '/api/option/payment_compliance',
    { confirmed: true }
  )
  return res.data
}

export async function startLogCleanupTask(targetTimestamp: number) {
  const res = await api.post<SystemTaskResponse<LogCleanupTask>>(
    '/api/system-task/log-cleanup',
    null,
    {
      params: { target_timestamp: targetTimestamp },
    }
  )
  return res.data
}

export async function getCurrentLogCleanupTask() {
  const res = await api.get<SystemTaskResponse<LogCleanupTask | null>>(
    '/api/system-task/current',
    {
      params: { type: 'log_cleanup' },
    }
  )
  return res.data
}

export async function getSystemTask(taskId: string) {
  const res = await api.get<SystemTaskResponse<LogCleanupTask>>(
    `/api/system-task/${taskId}`
  )
  return res.data
}

export async function listSystemTasks(
  limit = 20,
  filters: SystemTaskFilters = {}
) {
  const res = await api.get<SystemTaskListResponse>('/api/system-task/list', {
    params: { limit, ...filters },
  })
  return res.data
}

export async function resetModelRatios() {
  const res = await api.post<UpdateOptionResponse>(
    '/api/option/rest_model_ratio'
  )
  return res.data
}

export async function getUpstreamChannels() {
  const res = await api.get<UpstreamChannelsResponse>(
    '/api/ratio_sync/channels'
  )
  return res.data
}

export async function fetchUpstreamRatios(request: FetchUpstreamRatiosRequest) {
  const res = await api.post<UpstreamRatiosResponse>(
    '/api/ratio_sync/fetch',
    request
  )
  return res.data
}

export async function getPaymentConfigs() {
  const res = await api.get<PaymentConfigsResponse>('/api/payment-config/')
  return res.data
}

export async function getPaymentConfigByProvider(
  provider: PaymentConfigProvider
) {
  const res = await api.get<PaymentConfigResponse>(
    `/api/payment-config/provider/${provider}`
  )
  return res.data
}

export async function createPaymentConfig(request: PaymentConfig) {
  const res = await api.post<PaymentConfigResponse>(
    '/api/payment-config/',
    request
  )
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to create payment config')
  }
  return res.data
}

export async function updatePaymentConfig(id: number, request: PaymentConfig) {
  const res = await api.put<PaymentConfigResponse>(
    `/api/payment-config/${id}`,
    request
  )
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to update payment config')
  }
  return res.data
}

// Vendor Official Pricing Sync (PR-7e)
export async function getVendorPricingOverrides() {
  const res = await api.get<VendorPricingOverridesResponse>(
    '/api/vendor-pricing/overrides'
  )
  return res.data
}

export async function postVendorPricingSync(request: VendorPricingSyncRequest) {
  const res = await api.post<VendorPricingSyncResponse>(
    '/api/vendor-pricing/sync',
    request
  )
  return res.data
}

export async function deleteVendorPricingOverride(modelName: string) {
  const res = await api.delete<{ success: boolean }>(
    `/api/vendor-pricing/overrides/${encodeURIComponent(modelName)}`
  )
  return res.data
}
