/*
Copyright (C) 2023-2026 QuantumNous
*/
import { api } from '@/lib/api'
import { createServerError } from '@/lib/server-error-message'

import type {
  PartnerOAuthClient,
  PartnerOAuthClientCreateInput,
  PartnerOAuthClientUpdateInput,
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
