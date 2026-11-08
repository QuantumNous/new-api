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
import { describe, expect, test } from 'vitest'

import { resolveLegacyRoute } from './legacy-route'

describe('legacy frontend route migration', () => {
  test('maps former public and console routes to their current destinations', () => {
    const routes = {
      '/login': '/login',
      '/forbidden': '/403',
      '/console': '/app/workspace',
      '/console/models': '/admin/models',
      '/console/deployment': '/admin/models/deployments',
      '/console/subscription': '/admin/subscriptions',
      '/console/channel': '/admin/channels',
      '/console/token': '/app/keys',
      '/console/playground': '/app/playground',
      '/console/redemption': '/admin/redemption-codes',
      '/console/user': '/admin/users',
      '/console/personal': '/app/profile',
      '/console/log': '/app/usage-logs',
      '/console/midjourney': '/app/usage-logs/drawing',
      '/console/task': '/app/usage-logs/task',
      '/console/chat/42': '/app/chat/42',
    }

    for (const [source, target] of Object.entries(routes)) {
      expect(resolveLegacyRoute(source)).toBe(target)
    }
  })

  test('preserves search and hash while applying route-specific behavior', () => {
    expect(resolveLegacyRoute('/login?redirect=%2Fkeys#continue')).toBe(
      '/login?redirect=%2Fkeys#continue'
    )
    expect(resolveLegacyRoute('/console/topup?source=email#orders')).toBe(
      '/app/wallet?source=email#orders'
    )
  })

  test('maps legacy settings tabs and retains unrelated parameters', () => {
    const settingsTabs = {
      operation: '/admin/system-settings/operations/behavior',
      dashboard: '/admin/system-settings/content/dashboard',
      chats: '/admin/system-settings/content/chat',
      drawing: '/admin/system-settings/content/drawing',
      payment: '/admin/system-settings/billing/payment',
      ratio: '/admin/system-settings/billing/model-pricing',
      ratelimit: '/admin/system-settings/security/rate-limit',
      models: '/admin/system-settings/models/global',
      'model-deployment': '/admin/system-settings/models/model-deployment',
      performance: '/admin/system-settings/operations/performance',
      system: '/admin/system-settings/site/system-info',
      other: '/admin/system-settings/site/system-info',
    }

    for (const [tab, target] of Object.entries(settingsTabs)) {
      expect(
        resolveLegacyRoute(`/console/setting?tab=${tab}&from=bookmark#form`)
      ).toBe(`${target}?tab=${tab}&from=bookmark#form`)
    }
    expect(resolveLegacyRoute('/console/setting?tab=unknown')).toBe(
      '/admin/system-settings?tab=unknown'
    )
  })

  test('safely redirects unknown console locations without touching new routes', () => {
    expect(resolveLegacyRoute('/console/removed?page=2#old')).toBe(
      '/app/workspace?page=2#old'
    )
    expect(resolveLegacyRoute('/app/workspace')).toBe(null)
    expect(resolveLegacyRoute('/api/status')).toBe(null)
  })
})
