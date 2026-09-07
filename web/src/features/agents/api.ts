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

export type AgentProfile = {
  user_id: number
  enabled: boolean
  price_cents: number
  version: number
  updated_at: number
}
export type AgentSelf = {
  profile: AgentProfile
  invite_code?: string
  model: string
  minimum_cents: number
  maximum_cents: number
}
export type TopUpTotal = {
  user_id?: number
  payment_provider: string
  payment_method: string
  money: number
}
export type AgentCustomer = {
  id: number
  username: string
  display_name: string
  created_at: number
  price_cents: number | null
}
export type AgentInvitation = {
  token: string
  price_cents: number
  created_at: number
  expires_at: number
}
export type InvitationPreview = {
  model: string
  price_cents: number
  expires_at: number
}
export async function getAgentInvitations(): Promise<AgentInvitation[]> {
  return (await api.get('/api/agent/invitations')).data
}
export async function createAgentInvitation(
  price_cents: number
): Promise<AgentInvitation> {
  return (
    await api.post(
      '/api/agent/invitations',
      { price_cents },
      { skipErrorHandler: true }
    )
  ).data
}
export async function previewAgentInvitation(
  token: string
): Promise<InvitationPreview> {
  return (
    await api.get(`/api/agent-invitations/${encodeURIComponent(token)}`, {
      skipErrorHandler: true,
    })
  ).data
}
export type AgentCustomers = {
  customers: AgentCustomer[]
  total: number
  customer_topups: TopUpTotal[]
  totals: TopUpTotal[]
  paying_customers: number
}
export type AgentTopUp = TopUpTotal & {
  id: number
  complete_time: number
  status: string
}
export type CustomerPrice = {
  model: string
  price_cents: number | null
  version?: number
}
export async function getAgentSelf(): Promise<AgentSelf> {
  return (await api.get('/api/agent/self')).data
}
export async function getCustomerPrice(): Promise<CustomerPrice> {
  return (
    await api.get('/api/agent/customer-price', { skipErrorHandler: true })
  ).data
}
export async function getAgentCustomers(page: number): Promise<AgentCustomers> {
  return (
    await api.get('/api/agent/customers', {
      params: { p: page, page_size: 20 },
    })
  ).data
}
export async function getAgentTopUps(
  id: number,
  page: number
): Promise<{ items: AgentTopUp[]; total: number }> {
  return (
    await api.get(`/api/agent/customers/${id}/topups`, {
      params: { p: page, page_size: 20 },
    })
  ).data
}
export async function getAdminAgent(id: number): Promise<AgentProfile> {
  return (await api.get(`/api/agents/${id}`)).data
}
export async function saveAdminAgent(
  profile: AgentProfile
): Promise<AgentProfile> {
  return (
    await api.put(
      `/api/agents/${profile.user_id}`,
      {
        enabled: profile.enabled,
        price_cents: profile.price_cents,
        version: profile.version,
      },
      { skipErrorHandler: true }
    )
  ).data
}
