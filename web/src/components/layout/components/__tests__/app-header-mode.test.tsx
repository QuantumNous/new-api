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
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useConsoleModeStore } from '@/stores/console-mode-store'
import { renderApp } from '@/test-utils/render-app'

import { AppHeader } from '../app-header'

vi.mock('@/components/config-drawer', () => ({
  ConfigDrawer: () => <button type='button'>Theme settings</button>,
}))
vi.mock('@/components/language-switcher', () => ({
  LanguageSwitcher: () => <button type='button'>Language</button>,
}))
vi.mock('@/components/notification-popover', () => ({
  NotificationPopover: () => <button type='button'>Notifications</button>,
}))
vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => <button type='button'>Profile</button>,
}))
vi.mock('@/components/search', () => ({
  Search: () => <button type='button'>Search</button>,
}))
vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: () => ({
    popoverOpen: false,
    setPopoverOpen: vi.fn(),
    unreadCount: 0,
    activeTab: 'notice',
    setActiveTab: vi.fn(),
    notice: null,
    announcements: [],
    loading: false,
  }),
}))
vi.mock('../header', () => ({
  Header: (props: { children: ReactNode }) => <header>{props.children}</header>,
}))
vi.mock('../easy-task-dock', () => ({
  EasyTaskDock: () => <nav>Easy task dock</nav>,
}))
vi.mock('../system-brand', () => ({
  SystemBrand: () => <span>野菜API</span>,
}))

let client: QueryClient
const previousMode = useConsoleModeStore.getState().mode

afterEach(() => {
  cleanup()
  client.clear()
  useConsoleModeStore.getState().setMode(previousMode)
})

describe('application header console mode', () => {
  beforeEach(() => {
    window.localStorage.clear()
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    client.setQueryData(['status'], {
      docs_link: 'https://docs.example.com',
    })
  })

  it('removes developer navigation, search, and notifications in easy mode', async () => {
    useConsoleModeStore.getState().setMode('easy')
    await renderApp(<AppHeader />, client)

    expect(screen.getByText('Easy task dock')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Notifications' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Model Square' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Language' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Theme settings' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Language' }).parentElement
    ).toHaveClass('shrink-0')
  })

  it('keeps developer navigation and tools without the search bar', async () => {
    useConsoleModeStore.getState().setMode('developer')
    await renderApp(<AppHeader />, client)

    expect(screen.queryByText('Easy task dock')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Search' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeVisible()
    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    })
    expect(
      navigation.compareDocumentPosition(
        screen.getByRole('button', { name: 'Notifications' })
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      within(navigation)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Home', 'Overview', 'Model Square', 'Rankings', 'Docs', 'About'])
    expect(
      within(navigation).getByRole('link', { name: 'Model Square' })
    ).toHaveAttribute('href', '/pricing')
    expect(
      within(navigation).getByRole('link', { name: 'Docs' })
    ).toHaveAttribute('href', 'https://docs.example.com')
  })

  it('uses the private developer guide when no external docs link is configured', async () => {
    useConsoleModeStore.getState().setMode('developer')
    client.setQueryData(['status'], {})
    await renderApp(<AppHeader />, client)

    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    })
    expect(
      within(navigation).getByRole('link', { name: 'Docs' })
    ).toHaveAttribute('href', '/guide')
  })

  it('honors disabled backend modules in developer navigation', async () => {
    useConsoleModeStore.getState().setMode('developer')
    client.setQueryData(['status'], {
      HeaderNavModules: JSON.stringify({
        pricing: false,
        rankings: false,
        docs: false,
      }),
    })
    await renderApp(<AppHeader />, client)

    expect(screen.queryByRole('link', { name: 'Model Square' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Rankings' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Docs' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Overview' })).toBeVisible()
  })

  it('lets the keyboard move directly between site links without opening a menu', async () => {
    const user = userEvent.setup()
    useConsoleModeStore.getState().setMode('developer')
    await renderApp(<AppHeader />, client)
    const home = screen.getByRole('link', { name: 'Home' })
    home.focus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveFocus()

    expect(screen.getByRole('link', { name: 'Model Square' })).toHaveAttribute(
      'href',
      '/pricing'
    )
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'target',
      '_blank'
    )
    expect(
      screen.queryByRole('button', { name: 'Site' })
    ).not.toBeInTheDocument()
  })

  it('does not restore fallback links when every site module is disabled', async () => {
    useConsoleModeStore.getState().setMode('developer')
    client.setQueryData(['status'], {
      HeaderNavModules: JSON.stringify({
        home: false,
        console: false,
        pricing: false,
        rankings: false,
        docs: false,
        about: false,
      }),
    })
    await renderApp(<AppHeader />, client)
    expect(
      screen.queryByRole('navigation', { name: 'Main navigation' })
    ).not.toBeInTheDocument()
  })
})
