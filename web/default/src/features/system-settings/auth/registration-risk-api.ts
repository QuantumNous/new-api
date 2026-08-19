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
import type { UpdateOptionsRequest } from '../types'

export type RegistrationRiskSettingsForm = {
  domainRiskEnabled: boolean
  windowHours: number
  threshold: number
  trustedDomains: string
  emailBlacklistPatterns: string
}

export type RegistrationDomainBlock = {
  id: number
  domain: string
  window_hours: number
  threshold: number
  observed_count: number
  window_started_at: number
  blocked_at: number
  released_at: number
  released_by: number
  restore_users: boolean
  affected_user_count: number
}

export type RegistrationDomainAffectedUser = {
  id: number
  block_id: number
  user_id: number
  prior_status: number
  disabled_at: number
  restored_at: number
  restored_by: number
  username: string
  email: string
  current_status: number
}

export type RegistrationDomainBlockDetail = {
  block: RegistrationDomainBlock
  users: RegistrationDomainAffectedUser[]
  user_total: number
  user_page: number
  user_page_size: number
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export type RegistrationDomainBlockPage = {
  page: number
  page_size: number
  total: number
  items: RegistrationDomainBlock[]
}

export type RegistrationRiskReleaseAction = 'restore-and-trust' | 'release-only'

export type RegistrationRiskReleaseRequest = {
  restore_users: boolean
  add_trusted_domain: boolean
}

function normalizeLines(
  value: string,
  transform: (value: string) => string
): string[] {
  const seen = new Set<string>()
  const domains: string[] = []

  for (const rawDomain of value.split('\n')) {
    const domain = transform(rawDomain.trim())
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    domains.push(domain)
  }

  return domains
}

export function buildRegistrationRiskOptionRequest(
  values: RegistrationRiskSettingsForm
): UpdateOptionsRequest {
  return {
    options: [
      {
        key: 'registration_security.domain_risk_enabled',
        value: String(values.domainRiskEnabled),
      },
      {
        key: 'registration_security.domain_risk_window_hours',
        value: String(values.windowHours),
      },
      {
        key: 'registration_security.domain_risk_threshold',
        value: String(values.threshold),
      },
      {
        key: 'registration_security.trusted_email_domains',
        value: JSON.stringify(
          normalizeLines(values.trustedDomains, (value) => value.toLowerCase())
        ),
      },
      {
        key: 'registration_security.email_blacklist_patterns',
        value: JSON.stringify(
          normalizeLines(values.emailBlacklistPatterns, (value) => value)
        ),
      },
    ],
  }
}

export function buildRegistrationRiskReleaseRequest(
  action: RegistrationRiskReleaseAction
): RegistrationRiskReleaseRequest {
  if (action === 'restore-and-trust') {
    return { restore_users: true, add_trusted_domain: true }
  }
  return { restore_users: false, add_trusted_domain: false }
}

export function unwrapRegistrationRiskResponse<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(
      response.message || 'Registration domain risk request failed'
    )
  }
  return response.data
}

export async function getRegistrationDomainBlocks(page = 1, pageSize = 20) {
  const response = await api.get<ApiResponse<RegistrationDomainBlockPage>>(
    '/api/registration-domain-risk/blocks',
    { params: { p: page, page_size: pageSize } }
  )
  return unwrapRegistrationRiskResponse(response.data)
}

export function buildRegistrationDomainBlockDetailUrl(
  blockId: number,
  page: number,
  pageSize: number
): string {
  return `/api/registration-domain-risk/blocks/${blockId}?p=${page}&page_size=${pageSize}`
}

export async function getRegistrationDomainBlock(
  blockId: number,
  page: number,
  pageSize: number
) {
  const response = await api.get<ApiResponse<RegistrationDomainBlockDetail>>(
    buildRegistrationDomainBlockDetailUrl(blockId, page, pageSize)
  )
  return unwrapRegistrationRiskResponse(response.data)
}

export async function releaseRegistrationDomainBlock(
  blockId: number,
  action: RegistrationRiskReleaseAction
) {
  const response = await api.post<ApiResponse<unknown>>(
    `/api/registration-domain-risk/blocks/${blockId}/release`,
    buildRegistrationRiskReleaseRequest(action)
  )
  return unwrapRegistrationRiskResponse(response.data)
}
