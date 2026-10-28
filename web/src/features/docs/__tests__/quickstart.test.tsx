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
import { render, renderHook, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { useTopNavLinks } from '@/hooks/use-top-nav-links'

import { QuickStartContent } from '..'

async function renderQuickStart() {
  const root = createRootRoute({
    component: () => (
      <QuickStartContent apiBaseUrl='https://gateway.example.com/v1' />
    ),
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'TokenInfra quick start' })
}

describe('TokenInfra quick start', () => {
  test('setup example includes the deployment API address and a placeholder key', async () => {
    await renderQuickStart()
    expect(screen.getByLabelText('Configure')).toHaveTextContent(
      'https://gateway.example.com/v1'
    )
    expect(screen.getByLabelText('Configure')).toHaveTextContent('YOUR_API_KEY')
    expect(screen.getByLabelText('API example')).toHaveTextContent(
      'os.environ["TOKENINFRA_API_KEY"]'
    )
  })

  test('quick start provides working key-management and model-selection destinations', async () => {
    await renderQuickStart()
    expect(screen.getByRole('link', { name: 'API Keys' })).toHaveAttribute(
      'href',
      '/keys'
    )
    expect(screen.getByRole('link', { name: 'Model Square' })).toHaveAttribute(
      'href',
      '/pricing'
    )
  })

  test('top navigation stays local when backend documentation points elsewhere', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    })
    client.setQueryData(['status'], { docs_link: 'https://docs.example.com' })
    const { result } = renderHook(() => useTopNavLinks(), {
      wrapper: (props) => (
        <QueryClientProvider client={client}>
          {props.children}
        </QueryClientProvider>
      ),
    })
    expect(result.current.find((link) => link.title === 'Docs')).toEqual({
      title: 'Docs',
      href: '/docs',
    })
  })
})
