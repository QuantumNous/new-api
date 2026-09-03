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
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useConsoleModeStore } from '@/stores/console-mode-store'

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

describe('application header console mode', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('removes developer navigation, search, and notifications in easy mode', () => {
    useConsoleModeStore.getState().setMode('easy')
    render(<AppHeader />)

    expect(screen.getByText('Easy task dock')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Notifications' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Language' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Theme settings' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Language' }).parentElement
    ).toHaveClass('shrink-0')
  })

  it('restores developer search and notifications without public site links', () => {
    useConsoleModeStore.getState().setMode('developer')
    render(<AppHeader />)

    expect(screen.queryByText('Easy task dock')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeVisible()
  })
})
