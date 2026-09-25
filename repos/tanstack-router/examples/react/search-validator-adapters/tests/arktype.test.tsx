import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import {
  Link,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import '@testing-library/jest-dom/vitest'
import { type } from 'arktype'

test('can navigate to the route', async () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <Link to="/users/arktype">Arktype</Link>,
  })

  const ArkType = () => {
    const { search } = arkTypeRoute.useSearch()

    return (
      <div>
        <div>{search}</div>
        <Link from="/users/arktype/" search={{ search: 'updated' }}>
          Update
        </Link>
      </div>
    )
  }

  const search = type({
    search: 'string = "default"',
  })

  const arkTypeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users/arkType',
    validateSearch: search,
    component: ArkType,
  })

  const routeTree = rootRoute.addChildren([indexRoute, arkTypeRoute])

  const router = createRouter({ routeTree, scrollRestoration: true })

  render(<RouterProvider router={router as any} />)

  const link = await screen.findByText('Arktype')

  fireEvent.click(link)

  expect(await screen.findByText('default')).toBeInTheDocument()

  const updateLink = await screen.findByText('Update')

  fireEvent.click(updateLink)

  expect(await screen.findByText('updated')).toBeInTheDocument()
})
