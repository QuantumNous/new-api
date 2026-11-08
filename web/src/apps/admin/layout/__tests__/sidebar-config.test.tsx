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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSidebarConfig } from '@/shared/hooks/use-sidebar-config'
import { api } from '@/shared/lib/api'
import { ROLE } from '@/shared/lib/roles'
import {
  parseSidebarModulesAdmin,
  serializeSidebarModulesAdmin,
} from '@/shared/lib/settings-config'
import { useAuthStore } from '@/shared/stores/auth-store'

import { useAdminSidebarData } from '../admin-nav-data'

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

function queryClientFor(status: Record<string, string>): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], status)
  return client
}

function sidebarFor(admin?: object, user?: object, canConfigure = true) {
  const client = queryClientFor({
    SidebarModulesAdmin: admin ? JSON.stringify(admin) : '',
  })
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'root',
    role: ROLE.SUPER_ADMIN,
    permissions: { sidebar_settings: canConfigure },
    sidebar_modules: user ? JSON.stringify(user) : '',
  })
  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }
  return renderHook(() => useSidebarConfig(useAdminSidebarData().navGroups), {
    wrapper: Wrapper,
  })
}

const allItems = (groups: ReturnType<typeof useAdminSidebarData>['navGroups']) =>
  groups.flatMap((group) => group.items)

describe('admin sidebar structure', () => {
  it('renders only the admin groups in a stable order', () => {
    const { result } = sidebarFor()

    expect(result.current.map((group) => group.id)).toEqual([
      'admin-console',
      'admin-api',
      'admin-security',
      'admin-system',
    ])
    expect(
      allItems(result.current).every(
        (item) => item.url?.startsWith('/admin') ?? true
      )
    ).toBe(true)
  })

  it('keeps every settings section exactly once', () => {
    const { result } = sidebarFor()
    const sectionTitles = allItems(result.current)
      .filter((item) => item.items?.length)
      .map((item) => item.title)

    expect(new Set(sectionTitles).size).toBe(sectionTitles.length)
    expect(sectionTitles).toEqual([
      'Billing & Payment',
      'Authentication',
      'Security & Limits',
      'Site & Branding',
      'Console Content',
      'Models',
      'Request policies',
      'Operations',
    ])
  })

  it('points the site settings entries at the admin system settings routes', () => {
    const { result } = sidebarFor()
    const site = allItems(result.current).find(
      (item) => item.title === 'Site & Branding'
    )

    expect(site?.items?.map((subItem) => subItem.url)).toEqual([
      '/admin/system-settings/site/system-info',
      '/admin/system-settings/site/notice',
      '/admin/system-settings/site/header-navigation',
      '/admin/system-settings/site/sidebar-modules',
    ])
  })
})

describe('audit log sidebar entry', () => {
  it('links Audit Logs to the admin audit log route', () => {
    const { result } = sidebarFor()
    const audit = allItems(result.current).find(
      (item) => item.title === 'Audit Logs'
    )

    expect(audit?.url).toBe('/admin/audit-logs')
  })

  it('keeps an independent audit toggle when the configuration is saved', () => {
    const config = parseSidebarModulesAdmin(
      '{"console":{"enabled":true,"log":true}}'
    )
    expect(config.console.audit).toBe(true)

    config.console.audit = false
    const saved = parseSidebarModulesAdmin(serializeSidebarModulesAdmin(config))
    const { result } = sidebarFor(saved)

    expect(allItems(result.current).map((item) => item.title)).not.toContain(
      'Audit Logs'
    )
  })

  it.each([
    [{ console: { enabled: true, audit: false } }, undefined],
    [{ console: { enabled: false } }, { console: { audit: true } }],
    [undefined, { console: { enabled: true, audit: false } }],
  ])(
    'admin and personal visibility rules can hide Audit Logs (%j, %j)',
    (admin, user) => {
      const { result } = sidebarFor(admin, user)
      expect(
        allItems(result.current).some((item) => item.title === 'Audit Logs')
      ).toBe(false)
    }
  )
})

describe('settings module switch', () => {
  it('hides every settings section when the admin disables the settings module', () => {
    const { result } = sidebarFor({ admin: { enabled: true, setting: false } })
    const titles = allItems(result.current).map((item) => item.title)

    expect(titles).not.toContain('Site & Branding')
    expect(titles).not.toContain('Billing & Payment')
    expect(titles).not.toContain('Authentication')
    expect(titles).not.toContain('Operations')
    expect(titles).toContain('Audit Logs')
  })
})

describe('model pricing badge', () => {
  function issue(modelName: string, pluginKey: string) {
    return {
      model_name: modelName,
      plugin_key: pluginKey,
      plugin_name: pluginKey,
      reason: 'unconfigured',
    }
  }

  function renderAdminNav(role: number) {
    const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
      const issues =
        url === '/api/option/model_pricing/issues'
          ? [
              issue('kling-v3', 'kling'),
              issue('shared-video', 'alpha'),
              issue('shared-video', 'beta'),
            ]
          : {}
      return { data: { success: true, data: issues } }
    })
    const client = queryClientFor({ SidebarModulesAdmin: '' })
    useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role })
    function Wrapper(props: { children: ReactNode }) {
      return (
        <QueryClientProvider client={client}>
          {props.children}
        </QueryClientProvider>
      )
    }
    return {
      get,
      ...renderHook(() => useAdminSidebarData(), { wrapper: Wrapper }),
    }
  }

  it('counts each task model once on the Billing & Payment entry', async () => {
    const { result } = renderAdminNav(ROLE.SUPER_ADMIN)

    await waitFor(() => {
      const billing = allItems(result.current.navGroups).find(
        (item) => item.title === 'Billing & Payment'
      )
      expect(billing?.badge).toBe('2')
    })
  })

  it('never asks for the count below the super administrator role', async () => {
    const { get } = renderAdminNav(ROLE.ADMIN)

    await waitFor(() => {
      expect(get).not.toHaveBeenCalledWith('/api/option/model_pricing/issues')
    })
  })
})
