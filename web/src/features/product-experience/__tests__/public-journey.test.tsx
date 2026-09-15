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
import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CiLandingPage } from '@/features/home/components/ci-landing-page'
import { renderApp } from '@/test-utils/render-app'

let client: QueryClient | undefined
afterEach(() => client?.clear())
describe('public product journey', () => {
  it('keeps account, catalog and setup entry points without supplier solicitation', async () => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    client.setQueryData(['status'], {}, { updatedAt: Date.now() + 60000 })
    await renderApp(
      <CiLandingPage
        isAuthenticated={false}
        models={[]}
        maxSavingsPercent={0}
      />,
      client
    )
    expect(
      screen
        .getAllByRole('link', { name: 'Start saving' })
        .every((link) => link.getAttribute('href') === '/sign-up')
    ).toBe(true)
    expect(screen.getByRole('link', { name: 'Models' })).toHaveAttribute(
      'href',
      '/#models'
    )
    expect(
      screen.queryByRole('link', { name: 'Model Price' })
    ).not.toBeInTheDocument()
    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    })
    const clientLink = within(navigation).getByRole('link', { name: 'Client' })
    expect(clientLink).toHaveAttribute('href', '/client')
    expect(
      within(navigation).queryByRole('link', { name: 'Docs' })
    ).not.toBeInTheDocument()
    expect(
      screen
        .queryAllByRole('link')
        .some((link) => link.getAttribute('href')?.startsWith('/guide'))
    ).toBe(false)
    expect(
      screen.getByRole('heading', {
        name: 'Change two values. Access every leading provider.',
      })
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', {
        name: 'Turn unused inference capacity into revenue',
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('form', { name: 'Sell capacity' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryAllByRole('link', { name: 'Sell capacity' })
    ).toHaveLength(0)
    expect(
      screen.queryAllByRole('link', { name: 'Talk to sales' })
    ).toHaveLength(0)
  })
})
