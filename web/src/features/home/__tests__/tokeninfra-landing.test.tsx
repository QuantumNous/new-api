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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, describe, expect, test, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'

import { TokenInfraLanding } from '../components/tokeninfra-landing'

async function renderLanding(isAuthenticated = false, docsUrl = '/docs') {
  const route = createRootRoute({
    component: () => (
      <TokenInfraLanding isAuthenticated={isAuthenticated} docsUrl={docsUrl} />
    ),
  })
  const router = createRouter({
    routeTree: route,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return screen.findByRole('main')
}

afterEach(async () => {
  await i18next.changeLanguage('en')
})

describe('TokenInfra landing page', () => {
  test('anonymous visitors can reach registration and model pricing', async () => {
    await renderLanding()
    expect(
      screen.getAllByRole('link', { name: /Get Started/ })[0]
    ).toHaveAttribute('href', '/sign-up')
    expect(screen.getByRole('link', { name: /View Pricing/ })).toHaveAttribute(
      'href',
      '/pricing'
    )
  })

  test('authenticated visitors are sent to the dashboard', async () => {
    await renderLanding(true)
    for (const link of screen.getAllByRole('link', {
      name: /Go to Dashboard/,
    })) {
      expect(link).toHaveAttribute('href', '/dashboard')
    }
    expect(
      screen.queryByRole('link', { name: /Get Started/ })
    ).not.toBeInTheDocument()
  })

  test('documentation opens the local quick start in the same tab', async () => {
    await renderLanding()
    const docs = screen.getByRole('link', { name: 'Docs' })
    expect(docs).toHaveAttribute('href', '/docs')
    expect(docs).not.toHaveAttribute('target', '_blank')
  })

  test('in-page factory navigation has a visible matching section', async () => {
    await renderLanding()
    expect(
      screen.getByRole('link', { name: /Explore the token factory/ })
    ).toHaveAttribute('href', '#token-factory')
    expect(
      screen.getByRole('region', {
        name: 'One gateway. A complete token factory.',
      })
    ).toHaveAttribute('id', 'token-factory')
    expect(
      screen.getByRole('img', {
        name: 'Compute flows through TokenInfra to power AI applications',
      })
    ).toBeInTheDocument()
  })

  test('copying the API example by keyboard reports success', async () => {
    const user = userEvent.setup()
    await renderLanding()
    const copy = screen.getByRole('button', { name: 'Copy code' })
    copy.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('status')).toHaveTextContent('Copied')
    expect(await navigator.clipboard.readText()).toContain('TOKENINFRA_API_KEY')
  })

  test('clipboard rejection gives an accessible manual-copy fallback', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('denied')
    )
    await renderLanding()
    await user.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Copy failed. Select and copy the code manually.'
    )
  })

  test('switching to Chinese updates the main company message', async () => {
    i18next.addResourceBundle('en', 'translation', en.translation, true, true)
    i18next.addResourceBundle('zh', 'translation', zh.translation, true, true)
    await renderLanding()
    await act(async () => {
      await i18next.changeLanguage('zh')
    })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '让算力成为生产力'
    )
  })
})
