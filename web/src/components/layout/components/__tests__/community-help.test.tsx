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

import { AccessAuthLayout } from '@/features/auth/access-auth-layout'
import { SUPPORT_QQ_GROUP } from '@/lib/support-contact'
import { renderApp } from '@/test-utils/render-app'

import { AppHeader } from '../app-header'
import { CommunityHelp } from '../community-help'
import { PublicHeader } from '../public-header'

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
vi.mock('../easy-task-dock', () => ({
  EasyTaskDock: () => <nav>Easy task dock</nav>,
}))
vi.mock('../header', () => ({
  Header: (props: { children: ReactNode }) => <header>{props.children}</header>,
}))
vi.mock('../system-brand', () => ({
  SystemBrand: () => <span>Yecai API</span>,
}))

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  client.setQueryData(['status'], {})
})

afterEach(() => {
  cleanup()
  client.clear()
})

describe('community help entry', () => {
  it('shows the QQ group QR code and closes it again', async () => {
    const user = userEvent.setup()
    await renderApp(<CommunityHelp variant='header' />, client)

    const trigger = screen.getByRole('button', { name: 'Get Help' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('img', { name: 'QQ after-sales group QR code' })
    ).toHaveAttribute('src', '/qq-community-qr.png')
    expect(screen.getByText(`QQ group: ${SUPPORT_QQ_GROUP}`)).toBeVisible()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays in the public header for visitors who are not signed in', async () => {
    const user = userEvent.setup()
    await renderApp(<PublicHeader />, client)

    const header = screen.getByRole('banner')

    await user.click(
      within(header).getAllByRole('button', { name: 'Get Help' })[0]
    )

    expect(
      within(header).getByRole('img', {
        name: 'QQ after-sales group QR code',
      })
    ).toBeVisible()
  })

  it('stays in the console top bar', async () => {
    await renderApp(<AppHeader />, client)

    expect(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'Get Help',
      })
    ).toBeVisible()
  })

  it('stays on the sign-in header', async () => {
    await renderApp(
      <AccessAuthLayout title='Sign in'>
        <p>Login form</p>
      </AccessAuthLayout>,
      client
    )

    expect(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'Get Help',
      })
    ).toBeVisible()
  })
})
