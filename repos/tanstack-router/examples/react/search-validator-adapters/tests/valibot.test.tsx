import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import {
  Link,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import * as v from 'valibot'
import '@testing-library/jest-dom/vitest'

test('can navigate to the route', async () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <Link to="/users/valibot">Valibot</Link>,
  })

  const Valibot = () => {
    const { search } = valibotRoute.useSearch()

    return (
      <div>
        <div>{search}</div>
        <Link from="/users/valibot/" search={{ search: 'updated' }}>
          Update
        </Link>
      </div>
    )
  }

  const valibotRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users/valibot',
    validateSearch: v.object({
      search: v.optional(v.string(), 'default'),
    }),
    component: Valibot,
  })

  const routeTree = rootRoute.addChildren([indexRoute, valibotRoute])

  const router = createRouter({ routeTree, scrollRestoration: true })

  render(<RouterProvider router={router as any} />)

  const link = await screen.findByText('Valibot')

  fireEvent.click(link)

  expect(await screen.findByText('default')).toBeInTheDocument()

  const updateLink = await screen.findByText('Update')

  fireEvent.click(updateLink)

  expect(await screen.findByText('updated')).toBeInTheDocument()
})
