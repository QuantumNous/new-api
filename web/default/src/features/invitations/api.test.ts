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
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'bun:test'
import { api } from '@/lib/api'
import {
  buildInvitationListPath,
  getAffiliateCode,
  getInvitations,
} from './api'
import type { InvitationPageData } from './types'

const originalAdapter = api.defaults.adapter

function respondWith(data: unknown): void {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  })
}

afterEach(() => {
  api.defaults.adapter = originalAdapter
})

const invitationPage: InvitationPageData = {
  summary: {
    reward_mode: 'topup',
    inviter_reward_usd: 100,
    invitee_reward_usd: 50,
    inviter_reward_max_count: 10,
    history_usd: 200,
    pending_reward_usd: 100,
    granted_count: 2,
    pending_count: 1,
  },
  items: [],
  page: 1,
  page_size: 10,
  total: 0,
}

describe('buildInvitationListPath', () => {
  it('uses the canonical page and page_size query parameters', () => {
    expect(buildInvitationListPath(2, 10)).toBe(
      '/api/user/self/invitations?page=2&page_size=10'
    )
  })
})

describe('getInvitations', () => {
  it('rejects an explicit backend business failure', async () => {
    respondWith({ success: false, message: 'Invitation lookup failed' })

    await expect(getInvitations(1, 10)).rejects.toThrow(
      'Invitation lookup failed'
    )
  })

  it('rejects a successful envelope without invitation data', async () => {
    respondWith({ success: true })

    await expect(getInvitations(1, 10)).rejects.toThrow()
  })

  it('rejects a malformed envelope without explicit success', async () => {
    respondWith({ data: invitationPage })

    await expect(getInvitations(1, 10)).rejects.toThrow()
  })
})

describe('getAffiliateCode', () => {
  it('rejects an explicit backend business failure', async () => {
    respondWith({ success: false, message: 'Affiliate code unavailable' })

    await expect(getAffiliateCode()).rejects.toThrow(
      'Affiliate code unavailable'
    )
  })

  it('rejects a successful envelope with malformed data', async () => {
    respondWith({ success: true, data: 123 })

    await expect(getAffiliateCode()).rejects.toThrow()
  })
})
