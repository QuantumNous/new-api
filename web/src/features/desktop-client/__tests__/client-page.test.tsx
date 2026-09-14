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
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DesktopClientPage,
  type DesktopClientRuntime,
} from '@/features/desktop-client'
import { useAuthStore } from '@/stores/auth-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'
import { renderApp } from '@/test-utils/render-app'

let client: QueryClient
const originalAuth = useAuthStore.getState()

const WINDOWS_RUNTIME: DesktopClientRuntime = {
  hostname: 'example.com',
  environment: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    platform: 'Win32',
    maxTouchPoints: 0,
  },
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  client.setQueryData(['status'], {}, { updatedAt: Date.now() + 60000 })
})

afterEach(() => {
  client.clear()
  useAuthStore.setState(originalAuth)
  vi.restoreAllMocks()
})

describe('desktop client page', () => {
  it('offers the stable official installers without an unverified version claim', async () => {
    await renderApp(<DesktopClientPage runtime={WINDOWS_RUNTIME} />, client)

    const officialWindows =
      'https://ergou.qzz.io/releases/official/yeschoy-windows-x86_64-installer.exe'
    expect(
      screen.getByRole('link', { name: 'Download for Windows' })
    ).toHaveAttribute('href', officialWindows)
    expect(
      screen.getByRole('link', { name: 'Windows installer' })
    ).toHaveAttribute('href', officialWindows)
    expect(
      screen.getByRole('link', { name: 'Universal macOS DMG' })
    ).toHaveAttribute(
      'href',
      'https://ergou.qzz.io/releases/official/yeschoy-macos-universal-installer.dmg'
    )
    expect(screen.getByText('Windows 10 or later · x86_64')).toBeInTheDocument()
    expect(screen.getByText('Intel and Apple silicon')).toBeInTheDocument()
    expect(screen.queryByText(/v0\.4\.18/)).not.toBeInTheDocument()
  })

  it('uses stable partner links for the exact partner hostname', async () => {
    await renderApp(
      <DesktopClientPage
        runtime={{ ...WINDOWS_RUNTIME, hostname: 'ai.yeschoy.io' }}
      />,
      client
    )

    const partnerWindows =
      'https://ergou.qzz.io/releases/partner/yeschoy-windows-x86_64-installer.exe'
    expect(
      screen.getByRole('link', { name: 'Download for Windows' })
    ).toHaveAttribute('href', partnerWindows)
    expect(
      screen.getByRole('link', { name: 'Windows installer' })
    ).toHaveAttribute('href', partnerWindows)
    expect(
      screen.getByRole('link', { name: 'Universal macOS DMG' })
    ).toHaveAttribute(
      'href',
      'https://ergou.qzz.io/releases/partner/yeschoy-macos-universal-installer.dmg'
    )
  })

  it('guides unsupported systems to the manual download choices', async () => {
    const user = userEvent.setup()
    await renderApp(
      <DesktopClientPage
        runtime={{
          hostname: 'example.com',
          environment: {
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
            platform: 'Linux x86_64',
            maxTouchPoints: 0,
          },
        }}
      />,
      client
    )

    const automaticLink = screen.getByRole('link', {
      name: 'Download desktop client',
    })
    expect(automaticLink).toHaveAttribute('href', '#manual-downloads')
    await user.click(automaticLink)
    expect(screen.getByRole('status')).toHaveTextContent(
      'We could not detect a supported desktop system. Choose Windows or macOS below.'
    )
    expect(
      screen.getByRole('heading', { name: 'Choose your download' })
    ).toHaveFocus()
  })

  it('marks the client navigation item as the current page', async () => {
    await renderApp(<DesktopClientPage runtime={WINDOWS_RUNTIME} />, client)
    expect(screen.getByRole('link', { name: 'Client' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('preserves the authenticated marketing actions', async () => {
    const bundle = createTestAuthBundle()
    useAuthStore.getState().auth.setBundle({
      ...bundle,
      user: { ...bundle.user, display_name: 'Demo User' },
    })

    await renderApp(<DesktopClientPage runtime={WINDOWS_RUNTIME} />, client)

    expect(
      screen
        .getAllByRole('link', { name: 'Overview' })
        .every((link) => link.getAttribute('href') === '/dashboard')
    ).toBe(true)
    expect(
      screen.queryByRole('link', { name: 'Sign in' })
    ).not.toBeInTheDocument()
  })

  it('describes all four real product screenshots', async () => {
    await renderApp(<DesktopClientPage runtime={WINDOWS_RUNTIME} />, client)
    expect(screen.getAllByRole('img', { name: /Yecai Client/ })).toHaveLength(4)
  })

  it('presents the hero screenshot inside an accessible laptop frame', async () => {
    await renderApp(<DesktopClientPage runtime={WINDOWS_RUNTIME} />, client)
    const laptop = screen.getByRole('figure', {
      name: 'Yecai Client application overview',
    })
    expect(laptop).toHaveClass('client-laptop')
    expect(
      laptop.querySelector('img[src="/client/yecai-client-apps.png"]')
    ).toBeInTheDocument()
    expect(laptop.querySelector('.client-laptop__base')).toBeInTheDocument()
  })
})
