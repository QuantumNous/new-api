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
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DirectionProvider } from '@/shared/context/direction-provider'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

import type { PricingModel } from '../types'

vi.mock('../hooks/use-pricing-data', () => ({
  usePricingData: () => ({
    models: [exampleModel()],
    vendors: [],
    groupRatio: { default: 1 },
    usableGroup: { default: 1 },
    endpointMap: {},
    autoGroups: [],
    isLoading: false,
    priceRate: 1,
    usdExchangeRate: 1,
  }),
}))

vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))

function exampleModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'example-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    enable_groups: ['default'],
    group_ratio: { default: 1 },
    ...overrides,
  }
}

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
})

afterEach(() => {
  cleanup()
  useAuthStore.getState().auth.reset()
})

function signInAsRegularUser() {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'client',
    role: ROLE.USER,
    permissions: { sidebar_settings: true },
    sidebar_modules: '',
  })
}

async function renderPricingPage() {
  const { PricingPage } = await import('../index')
  const rootRoute = createRootRoute()
  const pricingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'pricing',
  })
  const indexRoute = createRoute({
    getParentRoute: () => pricingRoute,
    path: '/',
    component: () => <PricingPage />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([pricingRoute.addChildren([indexRoute])]),
    history: createMemoryHistory({ initialEntries: ['/pricing'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={queryClient}>
      <DirectionProvider>
        <RouterProvider router={router} />
      </DirectionProvider>
    </QueryClientProvider>
  )
}

describe('model square page shell', () => {
  it('keeps the standalone public layout for signed-out visitors', async () => {
    await renderPricingPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Model Square' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Model Square' })
    ).not.toBeInTheDocument()
    expect(document.querySelector('[data-slot="sidebar"]')).toBeNull()
  })

  it('opens the Model Square inside the console shell for signed-in users', async () => {
    signInAsRegularUser()
    await renderPricingPage()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Model Square' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Model Square' })
    ).not.toBeInTheDocument()
    expect(document.querySelector('[data-slot="sidebar"]')).not.toBeNull()
    expect(
      screen.getByRole('textbox', { name: 'Search models' })
    ).toBeInTheDocument()
  })
})

describe('model details page shell', () => {
  it('opens a model inside the console shell for signed-in users', async () => {
    signInAsRegularUser()

    const { ModelDetails } = await import('../components/model-details')
    const { AuthenticatedLayout } = await import('@/shared/components/layout')
    const rootRoute = createRootRoute()
    const detailsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'pricing/$modelId',
    })
    const indexRoute = createRoute({
      getParentRoute: () => detailsRoute,
      path: '/',
      component: () => (
        <AuthenticatedLayout navGroups={[]}>
          <ModelDetails variant='console' />
        </AuthenticatedLayout>
      ),
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([
        detailsRoute.addChildren([indexRoute]),
      ]),
      history: createMemoryHistory({
        initialEntries: ['/pricing/example-model'],
      }),
    })
    await router.load()
    render(
      <QueryClientProvider client={queryClient}>
        <DirectionProvider>
          <RouterProvider router={router} />
        </DirectionProvider>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: 'example-model' })
      ).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="sidebar"]')).not.toBeNull()
  })
})
