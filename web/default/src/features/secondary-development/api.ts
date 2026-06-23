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
  MarketplaceModel,
  MarketplaceModelDetail,
  ModelApiConfig,
  ModelKey,
  ModelPricing,
  PageData,
  Permission,
  ProviderProfile,
  ProviderSettlementConfig,
  ProviderWallet,
  Role,
  UserRole,
} from './types'

type PageParams = {
  p?: number
  page_size?: number
  keyword?: string
  provider_id?: number
  listed_only?: boolean
}

export async function getRoles(): Promise<ApiResponse<Role[]>> {
  const res = await api.get('/api/rbac/roles')
  return res.data
}

export async function getPermissions(): Promise<ApiResponse<Permission[]>> {
  const res = await api.get('/api/rbac/permissions')
  return res.data
}

export async function getUserRoles(
  userId: number
): Promise<ApiResponse<UserRole[]>> {
  const res = await api.get(`/api/rbac/users/${userId}/roles`)
  return res.data
}

export async function updateUserRoles(
  userId: number,
  roleCodes: string[]
): Promise<ApiResponse<{ user_id: number; role_codes: string[] }>> {
  const res = await api.put(`/api/rbac/users/${userId}/roles`, {
    role_codes: roleCodes,
  })
  return res.data
}

export async function getProviders(
  params: PageParams = {}
): Promise<ApiResponse<PageData<ProviderProfile>>> {
  const res = await api.get('/api/provider/', { params })
  return res.data
}

export async function saveProvider(
  provider: Partial<ProviderProfile>
): Promise<ApiResponse<ProviderProfile>> {
  const method = provider.id ? api.put : api.post
  const url = provider.id ? `/api/provider/${provider.id}` : '/api/provider/'
  const res = await method(url, provider)
  return res.data
}

export async function getProviderWallet(
  providerId: number
): Promise<ApiResponse<ProviderWallet>> {
  const res = await api.get(`/api/provider/${providerId}/wallet`)
  return res.data
}

export async function saveProviderWallet(
  providerId: number,
  wallet: Partial<ProviderWallet>
): Promise<ApiResponse<ProviderWallet>> {
  const res = await api.put(`/api/provider/${providerId}/wallet`, wallet)
  return res.data
}

export async function getProviderSettlement(
  providerId: number
): Promise<ApiResponse<ProviderSettlementConfig>> {
  const res = await api.get(`/api/provider/${providerId}/settlement`)
  return res.data
}

export async function saveProviderSettlement(
  providerId: number,
  settlement: Partial<ProviderSettlementConfig>
): Promise<ApiResponse<ProviderSettlementConfig>> {
  const res = await api.put(
    `/api/provider/${providerId}/settlement`,
    settlement
  )
  return res.data
}

export async function getMarketplaceModels(
  params: PageParams = {}
): Promise<ApiResponse<PageData<MarketplaceModel>>> {
  const res = await api.get('/api/marketplace-models/', { params })
  return res.data
}

export async function getMarketplaceModel(
  id: number
): Promise<ApiResponse<MarketplaceModelDetail>> {
  const res = await api.get(`/api/marketplace-models/${id}`)
  return res.data
}

export async function saveMarketplaceModel(
  model: Partial<MarketplaceModel>
): Promise<ApiResponse<MarketplaceModel>> {
  const method = model.id ? api.put : api.post
  const url = model.id
    ? `/api/marketplace-models/${model.id}`
    : '/api/marketplace-models/'
  const res = await method(url, model)
  return res.data
}

export async function deleteMarketplaceModel(
  id: number
): Promise<ApiResponse<null>> {
  const res = await api.delete(`/api/marketplace-models/${id}`)
  return res.data
}

export async function saveModelApiConfig(
  modelId: number,
  config: Partial<ModelApiConfig>
): Promise<ApiResponse<ModelApiConfig>> {
  const res = await api.post(
    `/api/marketplace-models/${modelId}/api-configs`,
    config
  )
  return res.data
}

export async function createModelKey(
  modelId: number,
  key: { name: string; key: string; status?: string }
): Promise<ApiResponse<ModelKey>> {
  const res = await api.post(`/api/marketplace-models/${modelId}/keys`, key)
  return res.data
}

export async function updateModelKey(
  modelId: number,
  keyId: number,
  key: { name?: string; key?: string; status?: string }
): Promise<ApiResponse<ModelKey>> {
  const res = await api.put(
    `/api/marketplace-models/${modelId}/keys/${keyId}`,
    key
  )
  return res.data
}

export async function deleteModelKey(
  modelId: number,
  keyId: number
): Promise<ApiResponse<null>> {
  const res = await api.delete(
    `/api/marketplace-models/${modelId}/keys/${keyId}`
  )
  return res.data
}

export async function saveModelPricing(
  modelId: number,
  pricing: Partial<ModelPricing>
): Promise<ApiResponse<ModelPricing>> {
  const res = await api.post(
    `/api/marketplace-models/${modelId}/pricing`,
    pricing
  )
  return res.data
}
