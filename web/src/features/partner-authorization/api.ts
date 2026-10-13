/*
Copyright (C) 2023-2026 QuantumNous
*/
import { api } from '@/lib/api'

export interface PartnerAuthorizationView {
  client_name: string
  client_id: string
  scopes: string[]
  redirect_host: string
  grant_expires_at: string
  active_binding_limit_reached: boolean
}

export interface PartnerAuthorizationDecisionResult {
  redirect_to: string
}

export async function getPartnerAuthorization(
  request: string
): Promise<PartnerAuthorizationView> {
  const response = await api.get('/api/partner-oauth/authorization', {
    params: { request },
  })
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Failed to load authorization')
  }
  return response.data.data
}

export async function decidePartnerAuthorization(
  request: string,
  decision: 'approve' | 'deny'
): Promise<PartnerAuthorizationDecisionResult> {
  const response = await api.post('/api/partner-oauth/authorization/decision', {
    request,
    decision,
  })
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Failed to submit decision')
  }
  return response.data.data
}
