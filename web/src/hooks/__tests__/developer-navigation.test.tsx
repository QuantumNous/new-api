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
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'

import { useSidebarView } from '@/hooks/use-sidebar-view'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { useConsoleModeStore } from '@/stores/console-mode-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'
import { renderApp } from '@/test-utils/render-app'

let client: QueryClient
const originalMode = useConsoleModeStore.getState().mode

function NavigationProbe() {
  const { navGroups } = useSidebarView()
  const links = useTopNavLinks()
  return (
    <>
      <nav aria-label='Site navigation'>
        {links.map((link) => (
          <a key={link.href} href={link.href}>
            {link.title}
          </a>
        ))}
      </nav>
      {navGroups.map((group) => (
        <nav key={group.id} aria-label={group.title}>
          {group.items.map((item) =>
            item.url ? (
              <a key={item.title} href={item.url}>
                {item.title}
              </a>
            ) : null
          )}
        </nav>
      ))}
    </>
  )
}

beforeEach(() => {
  useAuthStore.getState().auth.setBundle(createTestAuthBundle())
  useConsoleModeStore.getState().setMode('developer')
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  })
  client.setQueryData(['status'], { enable_data_export: true })
})

afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.getState().auth.reset()
  useConsoleModeStore.getState().setMode(originalMode)
})

it('aligns developer site and sidebar destinations without exposing admin links', async () => {
  await renderApp(<NavigationProbe />, client)
  const development = screen.getByRole('navigation', { name: 'Development' })
  expect(
    within(development).getByRole('link', { name: 'API Keys' })
  ).toHaveAttribute('href', '/keys')
  expect(
    within(development).getByRole('link', { name: 'Model Square' })
  ).toHaveAttribute('href', '/pricing')
  const site = screen.getByRole('navigation', { name: 'Site navigation' })
  expect(
    within(site).getByRole('link', { name: 'Model Square' })
  ).toHaveAttribute('href', '/pricing')
  const overviewLinks = screen.getAllByRole('link', { name: 'Overview' })
  expect(overviewLinks).toHaveLength(2)
  for (const link of overviewLinks) {
    expect(link).toHaveAttribute('href', '/dashboard/overview')
  }
  expect(
    screen.queryByRole('link', { name: 'Console' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Model catalog' })
  ).not.toBeInTheDocument()
  expect(
    within(development).getByRole('link', { name: 'Usage Logs' })
  ).toHaveAttribute('href', '/usage-logs/common')
  expect(screen.getByRole('navigation', { name: 'Analytics' })).toBeVisible()
  expect(screen.getByRole('navigation', { name: 'Account' })).toBeVisible()
  expect(
    screen.queryByRole('link', { name: 'Channels' })
  ).not.toBeInTheDocument()
})

it('keeps all analytics destinations behind the existing dashboard module switch', async () => {
  client.setQueryData(['status'], {
    enable_data_export: true,
    SidebarModulesAdmin: JSON.stringify({
      console: { enabled: true, detail: false, log: false },
    }),
  })
  await renderApp(<NavigationProbe />, client)
  expect(
    screen.queryByRole('navigation', { name: 'Analytics' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Usage Logs' })
  ).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'API Keys' })).toBeVisible()
})

it('retains administrator tools without granting super-admin-only tools', async () => {
  const bundle = createTestAuthBundle()
  useAuthStore
    .getState()
    .auth.setBundle({ ...bundle, user: { ...bundle.user, role: ROLE.ADMIN } })
  await renderApp(<NavigationProbe />, client)
  expect(screen.getByRole('link', { name: 'Channels' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'System Settings' })).toBeVisible()
  expect(
    screen.queryByRole('link', { name: 'System Info' })
  ).not.toBeInTheDocument()
})

it('honors the site model-catalog switch for the new developer destination', async () => {
  client.setQueryData(['status'], {
    HeaderNavModules: JSON.stringify({ pricing: false }),
  })
  await renderApp(<NavigationProbe />, client)
  expect(
    screen.queryByRole('link', { name: 'Model Square' })
  ).not.toBeInTheDocument()
})
