/*
Copyright (C) 2023-2026 QuantumNous
*/
import { api } from '@/lib/api'
import { createServerError } from '@/lib/server-error-message'

export const AUTHORIZATION_LOG_ACTIONS = [
  'partner_oauth.consent.approve',
  'partner_oauth.consent.deny',
  'partner_oauth.token.issue',
  'partner_oauth.code.replay_detected',
  'partner_oauth.refresh.reuse_detected',
  'partner_oauth.binding.revoke',
  'partner_oauth.binding.admin_revoke',
  'partner_oauth.binding.client_delete',
  'partner_oauth.credential.issue',
] as const

export interface AuthorizationLog {
  event_id: string
  created_at: number
  action: string
  success: boolean
  reason: string
  actor_user_id: number
  target_user_id: number
  client_id: string
  binding_id: string
  request_id: string
  ip: string
  route: string
  status: number
}

export interface AuthorizationLogFilters {
  page: number
  page_size: number
  action?: string
  success?: 'true' | 'false'
  client_id?: string
  target_user_id?: number
  start?: number
  end?: number
}

export async function listPartnerOAuthAuthorizationLogs(
  filters: AuthorizationLogFilters
): Promise<{ items: AuthorizationLog[]; total: number }> {
  const response = await api.get<{
    success: boolean
    message?: string
    data?: { items: AuthorizationLog[]; total: number }
  }>('/api/partner-oauth/authorization-logs', { params: filters })
  if (!response.data.success || !response.data.data) {
    throw createServerError(response.data, 'Failed to load authorization logs')
  }
  return response.data.data
}
