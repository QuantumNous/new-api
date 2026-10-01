import { beforeEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useCanGoBack,
  useLocation,
  useRouter,
} from '../src'

beforeEach(() => {
  cleanup()
})

describe('useCanGoBack', () => {
  function setup({
    initialEntries = ['/'],
  }: {
    initialEntries?: Array<string>
  } = {}) {
    function RootComponent() {
      const router = useRouter()
      const location = useLocation()
      const canGoBack = useCanGoBack()

      expect(canGoBack()).toBe(location().pathname === '/' ? false : true)

      return (
        <>
          <button onClick={() => router.history.back()}>Back</button>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Outlet />
        </>
      )
    }

    const rootRoute = createRootRoute({
      component: RootComponent,
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <h1>IndexTitle</h1>,
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      component: () => <h1>AboutTitle</h1>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, aboutRoute]),
      history: createMemoryHistory({ initialEntries }),
    })

    return render(() => <RouterProvider router={router} />)
  }

  test('when no location behind', async () => {
    setup()

    const indexTitle = await screen.findByText('IndexTitle')
    expect(indexTitle).toBeInTheDocument()

    const aboutLink = await screen.findByText('About')
    fireEvent.click(aboutLink)

    const aboutTitle = await screen.findByText('AboutTitle')
    expect(aboutTitle).toBeInTheDocument()
  })

  test('when location behind', async () => {
    setup({
      initialEntries: ['/', '/about'],
    })

    const aboutTitle = await screen.findByText('AboutTitle')
    expect(aboutTitle).toBeInTheDocument()

    const backButton = await screen.findByText('Back')
    fireEvent.click(backButton)

    const indexTitle = await screen.findByText('IndexTitle')
    expect(indexTitle).toBeInTheDocument()
  })
})
