/*
Copyright (C) 2023-2026 QuantumNous
*/
import { api } from '@/lib/api'
import { createServerError } from '@/lib/server-error-message'

import type {
  PartnerOAuthClient,
  PartnerOAuthClientCreateInput,
  PartnerOAuthClientUpdateInput,
  PartnerServerAccountPage,
  PartnerServerConfig,
  PartnerServerConfigInput,
  PartnerServerSecret,
} from './types'

interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

async function unwrap<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
  fallback: string
): Promise<T> {
  const response = await promise
  if (!response.data?.success) {
    throw createServerError(response.data, fallback)
  }
  return response.data.data as T
}

export function listPartnerOAuthClients(): Promise<PartnerOAuthClient[]> {
  return unwrap(
    api.get('/api/partner-oauth/clients'),
    'Failed to load partner OAuth clients'
  )
}

export function createPartnerOAuthClient(
  input: PartnerOAuthClientCreateInput,
  proofToken: string
): Promise<PartnerOAuthClient> {
  return unwrap(
    api.post('/api/partner-oauth/clients', input, {
      headers: { 'X-Security-Proof': proofToken },
      singleUseAuthorization: true,
    }),
    'Failed to create partner OAuth client'
  )
}

export function updatePartnerOAuthClient(
  id: number,
  input: PartnerOAuthClientUpdateInput,
  proofToken: string
): Promise<PartnerOAuthClient> {
  return unwrap(
    api.put(`/api/partner-oauth/clients/${id}`, input, {
      headers: { 'X-Security-Proof': proofToken },
      singleUseAuthorization: true,
    }),
    'Failed to update partner OAuth client'
  )
}

export function rotatePartnerOAuthClientSecret(
  id: number,
  proofToken: string
): Promise<PartnerOAuthClient> {
  return unwrap(
    api.post(`/api/partner-oauth/clients/${id}/secret`, undefined, {
      headers: { 'X-Security-Proof': proofToken },
      singleUseAuthorization: true,
    }),
    'Failed to rotate partner OAuth client secret'
  )
}

export function updatePartnerOAuthClientStatus(
  id: number,
  status: 1 | 2
): Promise<PartnerOAuthClient> {
  return unwrap(
    api.post(`/api/partner-oauth/clients/${id}/status`, { status }),
    'Failed to update partner OAuth client status'
  )
}

export function deletePartnerOAuthClient(
  id: number,
  proofToken: string
): Promise<void> {
  return unwrap(
    api.delete(`/api/partner-oauth/clients/${id}`, {
      headers: { 'X-Security-Proof': proofToken },
      singleUseAuthorization: true,
    }),
    'Failed to delete partner OAuth client'
  )
}

export function getPartnerServerConfig(
  id: number
): Promise<PartnerServerConfig> {
  return unwrap(
    api.get(`/api/partner-oauth/clients/${id}/server`),
    'Failed to load server access settings'
  )
}

export function updatePartnerServerConfig(
  id: number,
  input: PartnerServerConfigInput,
  proofToken: string
): Promise<PartnerServerConfig> {
  return unwrap(
    api.put(`/api/partner-oauth/clients/${id}/server`, input, {
      headers: { 'X-Security-Proof': proofToken },
      singleUseAuthorization: true,
    }),
    'Failed to save server access settings'
  )
}

export function issuePartnerServerSecret(
  id: number,
  proofToken: string
): Promise<{ secret: PartnerServerSecret; value: string }> {
  return unwrap(
    api.post(`/api/partner-oauth/clients/${id}/server-secrets`, undefined, {
      headers: { 'X-Security-Proof': proofToken },
      singleUseAuthorization: true,
    }),
    'Failed to issue server secret'
  )
}

export function revokePartnerServerSecret(
  id: number,
  secretId: number,
  proofToken: string
): Promise<void> {
  return unwrap(
    api.delete(`/api/partner-oauth/clients/${id}/server-secrets/${secretId}`, {
      headers: { 'X-Security-Proof': proofToken },
      singleUseAuthorization: true,
    }),
    'Failed to revoke server secret'
  )
}

export function revokePartnerServerKeys(
  id: number,
  proofToken: string
): Promise<void> {
  return unwrap(
    api.post(
      `/api/partner-oauth/clients/${id}/server-keys/revoke-all`,
      undefined,
      {
        headers: { 'X-Security-Proof': proofToken },
        singleUseAuthorization: true,
      }
    ),
    'Failed to revoke partner keys'
  )
}

export function listPartnerServerAccounts(
  id: number,
  page: number,
  pageSize: number
): Promise<PartnerServerAccountPage> {
  return unwrap(
    api.get(`/api/partner-oauth/clients/${id}/accounts`, {
      params: { p: page, page_size: pageSize },
    }),
    'Failed to load partner sub-accounts'
  )
}
