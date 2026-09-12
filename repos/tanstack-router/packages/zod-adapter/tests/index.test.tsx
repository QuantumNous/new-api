import { afterEach, expect, test, vi } from 'vitest'
import { zodValidator } from '../src'
import { z } from 'zod'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, 'root', '/')
  cleanup()
})

test('when navigating to a route with zodValidator', async () => {
  const rootRoute = createRootRoute()

  const Index = () => {
    return (
      <>
        <h1>Index</h1>
        <Link<typeof router, string, '/invoices'>
          to="/invoices"
          search={{
            page: 0,
          }}
        >
          To Invoices
        </Link>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Index,
  })

  const Invoices = () => {
    const search = invoicesRoute.useSearch()

    return (
      <>
        <h1>Invoices</h1>
        <span>Page: {search.page}</span>
      </>
    )
  }

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    validateSearch: zodValidator(
      z.object({
        page: z.number(),
      }),
    ),
    component: Invoices,
  })

  const routeTree = rootRoute.addChildren([indexRoute, invoicesRoute])
  const router = createRouter({ routeTree })

  render(<RouterProvider router={router} />)

  const invoicesLink = await screen.findByRole('link', {
    name: 'To Invoices',
  })

  fireEvent.click(invoicesLink)

  expect(await screen.findByText('Page: 0')).toBeInTheDocument()
})

test('when navigating to a route with zodValidator input set to output', async () => {
  const rootRoute = createRootRoute()

  const Index = () => {
    return (
      <>
        <h1>Index</h1>
        <Link<typeof router, string, '/invoices'>
          to="/invoices"
          search={{
            page: 0,
          }}
        >
          To Invoices
        </Link>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Index,
  })

  const Invoices = () => {
    const search = invoicesRoute.useSearch()

    return (
      <>
        <h1>Invoices</h1>
        <span>Page: {search.page}</span>
      </>
    )
  }

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    validateSearch: zodValidator({
      schema: z.object({
        page: z.number(),
      }),
      input: 'input',
    }),
    component: Invoices,
  })

  const routeTree = rootRoute.addChildren([indexRoute, invoicesRoute])
  const router = createRouter({ routeTree })

  render(<RouterProvider router={router} />)

  const invoicesLink = await screen.findByRole('link', {
    name: 'To Invoices',
  })

  fireEvent.click(invoicesLink)

  expect(await screen.findByText('Page: 0')).toBeInTheDocument()
})

test('when navigating to a route using zod without the adapter', async () => {
  const rootRoute = createRootRoute()

  const Index = () => {
    return (
      <>
        <h1>Index</h1>
        <Link<typeof router, string, '/invoices'>
          to="/invoices"
          search={{
            page: 0,
          }}
        >
          To Invoices
        </Link>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Index,
  })

  const Invoices = () => {
    const search = invoicesRoute.useSearch()

    return (
      <>
        <h1>Invoices</h1>
        <span>Page: {search.page}</span>
      </>
    )
  }

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    validateSearch: z.object({
      page: z.number(),
    }),
    component: Invoices,
  })

  const routeTree = rootRoute.addChildren([indexRoute, invoicesRoute])
  const router = createRouter({ routeTree })

  render(<RouterProvider router={router} />)

  const invoicesLink = await screen.findByRole('link', {
    name: 'To Invoices',
  })

  fireEvent.click(invoicesLink)

  expect(await screen.findByText('Page: 0')).toBeInTheDocument()
})

test('when navigating to a route using zod in a function without the adapter', async () => {
  const rootRoute = createRootRoute()

  const Index = () => {
    return (
      <>
        <h1>Index</h1>
        <Link<typeof router, string, '/invoices'>
          to="/invoices"
          search={{
            page: 0,
          }}
        >
          To Invoices
        </Link>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Index,
  })

  const Invoices = () => {
    const search = invoicesRoute.useSearch()

    return (
      <>
        <h1>Invoices</h1>
        <span>Page: {search.page}</span>
      </>
    )
  }

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    validateSearch: (input) =>
      z
        .object({
          page: z.number(),
        })
        .parse(input),
    component: Invoices,
  })

  const routeTree = rootRoute.addChildren([indexRoute, invoicesRoute])
  const router = createRouter({ routeTree })

  render(<RouterProvider router={router} />)

  const invoicesLink = await screen.findByRole('link', {
    name: 'To Invoices',
  })

  fireEvent.click(invoicesLink)

  expect(await screen.findByText('Page: 0')).toBeInTheDocument()
})
