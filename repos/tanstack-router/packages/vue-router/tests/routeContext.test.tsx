import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

import {
  Link,
  Outlet,
  RouterProvider,
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '../src'

import { sleep } from './utils'
import type { RouterHistory } from '../src'

let history: RouterHistory

beforeEach(() => {
  history = createBrowserHistory()
  expect(window.location.pathname).toBe('/')
})
afterEach(() => {
  history.destroy()
  window.history.replaceState(null, 'root', '/')
  vi.clearAllMocks()
  vi.resetAllMocks()
  cleanup()
})

const WAIT_TIME = 150

describe('context function', () => {
  describe('context is executed', () => {
    async function findByText(text: string) {
      const element = await screen.findByText(text)
      expect(element).toBeInTheDocument()
    }

    async function clickButton(name: string) {
      const button = await screen.findByRole('button', {
        name,
      })
      expect(button).toBeInTheDocument()
      fireEvent.click(button)
    }

    test('when the path params change', async () => {
      const mockContextFn = vi.fn()

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => {
          const navigate = indexRoute.useNavigate()
          return (
            <div>
              <h1>Index page</h1>

              <button
                onClick={() =>
                  navigate({ to: '/detail/$id', params: { id: 1 } })
                }
              >
                detail-1
              </button>
            </div>
          )
        },
      })
      const detailRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/detail/$id',
        params: {
          parse: (p) => z.object({ id: z.coerce.number() }).parse(p),
          stringify: (p) => ({ id: `${p.id}` }),
        },
        context: (args) => {
          mockContextFn(args.params)
        },
        component: () => {
          const id = detailRoute.useParams({ select: (params) => params.id })
          const navigate = detailRoute.useNavigate()
          return (
            <div>
              <h1>Detail page: {id.value}</h1>
              <button
                onClick={() =>
                  navigate({
                    to: '/detail/$id',
                    params: (p: any) => ({ ...p, id: p.id + 1 }),
                  })
                }
              >
                next
              </button>
            </div>
          )
        },
      })

      const routeTree = rootRoute.addChildren([indexRoute, detailRoute])
      const router = createRouter({ routeTree, history })

      await render(<RouterProvider router={router} />)

      await findByText('Index page')
      expect(mockContextFn).not.toHaveBeenCalled()

      await clickButton('detail-1')

      await findByText('Detail page: 1')
      console.log(mockContextFn.mock.calls)
      expect(mockContextFn).toHaveBeenCalledOnce()
      expect(mockContextFn).toHaveBeenCalledWith({ id: 1 })
      mockContextFn.mockClear()
      await clickButton('next')

      await findByText('Detail page: 2')
      expect(mockContextFn).toHaveBeenCalledOnce()
      expect(mockContextFn).toHaveBeenCalledWith({ id: 2 })
      mockContextFn.mockClear()
      await clickButton('next')

      await findByText('Detail page: 3')
      expect(mockContextFn).toHaveBeenCalledOnce()
      expect(mockContextFn).toHaveBeenCalledWith({ id: 3 })
      mockContextFn.mockClear()
    })

    test('when loader deps change', async () => {
      const mockContextFn = vi.fn()

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        validateSearch: z.object({
          foo: z.string().optional(),
          bar: z.string().optional(),
        }),
        path: '/',
        loaderDeps: ({ search }) => ({ foo: search.foo }),
        context: ({ deps }) => {
          mockContextFn(deps)
        },
        component: () => {
          const navigate = indexRoute.useNavigate()
          return (
            <div>
              <h1>Index page</h1>
              <h2>search: {JSON.stringify(indexRoute.useSearch().value)}</h2>
              <button
                onClick={() => {
                  navigate({ search: (p: any) => ({ ...p, foo: 'foo-1' }) })
                }}
              >
                foo-1
              </button>
              <button
                onClick={() => {
                  navigate({ search: (p: any) => ({ ...p, foo: 'foo-2' }) })
                }}
              >
                foo-2
              </button>
              <button
                onClick={() => {
                  navigate({ search: (p: any) => ({ ...p, bar: 'bar-1' }) })
                }}
              >
                bar-1
              </button>
              <button
                onClick={() => {
                  navigate({ search: (p: any) => ({ ...p, bar: 'bar-2' }) })
                }}
              >
                bar-2
              </button>
              <button
                onClick={() => {
                  navigate({ search: {} })
                }}
              >
                clear
              </button>
            </div>
          )
        },
      })

      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({ routeTree, history })

      render(<RouterProvider router={router} />)

      await findByText('Index page')
      await findByText(`search: ${JSON.stringify({})}`)

      expect(mockContextFn).toHaveBeenCalledOnce()
      expect(mockContextFn).toHaveBeenCalledWith({})
      mockContextFn.mockClear()

      await clickButton('foo-1')
      await findByText(`search: ${JSON.stringify({ foo: 'foo-1' })}`)
      expect(mockContextFn).toHaveBeenCalledOnce()
      expect(mockContextFn).toHaveBeenCalledWith({ foo: 'foo-1' })

      mockContextFn.mockClear()
      await clickButton('foo-1')
      await findByText(`search: ${JSON.stringify({ foo: 'foo-1' })}`)
      expect(mockContextFn).not.toHaveBeenCalled()

      await clickButton('bar-1')
      await findByText(
        `search: ${JSON.stringify({ foo: 'foo-1', bar: 'bar-1' })}`,
      )
      expect(mockContextFn).not.toHaveBeenCalled()

      await clickButton('foo-2')
      await findByText(
        `search: ${JSON.stringify({ foo: 'foo-2', bar: 'bar-1' })}`,
      )
      expect(mockContextFn).toHaveBeenCalledWith({ foo: 'foo-2' })
      mockContextFn.mockClear()

      await clickButton('bar-2')
      await findByText(
        `search: ${JSON.stringify({ foo: 'foo-2', bar: 'bar-2' })}`,
      )
      expect(mockContextFn).not.toHaveBeenCalled()

      await clickButton('clear')
      await findByText(`search: ${JSON.stringify({})}`)
      expect(mockContextFn).toHaveBeenCalledOnce()
      expect(mockContextFn).toHaveBeenCalledWith({})
    })
  })

  describe('accessing values in the context function', () => {
    test('receives an empty object', async () => {
      const mockIndexContextFn = vi.fn()

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        context: ({ context }) => {
          mockIndexContextFn(context)
        },
        component: () => <div>Index page</div>,
      })
      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({ routeTree, history })

      render(<RouterProvider router={router} />)

      const rootElement = await screen.findByText('Index page')
      expect(rootElement).toBeInTheDocument()

      expect(mockIndexContextFn).toHaveBeenCalledWith({})
    })

    test('receives an empty object - with an empty object when creating the router', async () => {
      const mockIndexContextFn = vi.fn()

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        context: ({ context }) => {
          mockIndexContextFn(context)
        },
        component: () => <div>Index page</div>,
      })
      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({ routeTree, history, context: {} })

      render(<RouterProvider router={router} />)

      const rootElement = await screen.findByText('Index page')
      expect(rootElement).toBeInTheDocument()

      expect(mockIndexContextFn).toHaveBeenCalledWith({})
    })

    test('receives valid values - with values added when creating the router', async () => {
      const mockIndexContextFn = vi.fn()

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        context: ({ context }) => {
          mockIndexContextFn(context)
        },
        component: () => <div>Index page</div>,
      })
      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({
        routeTree,
        history,
        context: { project: 'Router' },
      })

      render(<RouterProvider router={router} />)

      const rootElement = await screen.findByText('Index page')
      expect(rootElement).toBeInTheDocument()

      expect(mockIndexContextFn).toHaveBeenCalledWith({ project: 'Router' })
    })

    test('receives valid values when updating the values in the parent route to be read in the child route', async () => {
      const mockIndexContextFn = vi.fn()

      const rootRoute = createRootRoute({
        context: () => ({
          project: 'Router',
        }),
      })
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        context: ({ context }) => {
          mockIndexContextFn(context)
        },
        component: () => <div>Index page</div>,
      })
      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({ routeTree, history })

      render(<RouterProvider router={router} />)

      const rootElement = await screen.findByText('Index page')
      expect(rootElement).toBeInTheDocument()

      expect(mockIndexContextFn).toHaveBeenCalledWith({ project: 'Router' })
    })
  })

  describe('return values being available in beforeLoad', () => {
    test('when returning an empty object in a regular route', async () => {
      const mockIndexBeforeLoad = vi.fn()

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        context: () => ({}),
        beforeLoad: ({ context }) => {
          mockIndexBeforeLoad(context)
        },
        component: () => <div>Index page</div>,
      })
      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({
        routeTree,
        history,
        context: { project: 'foo' },
      })

      render(<RouterProvider router={router} />)

      const rootElement = await screen.findByText('Index page')
      expect(rootElement).toBeInTheDocument()

      expect(mockIndexBeforeLoad).toHaveBeenCalledWith({ project: 'foo' })
      expect(mockIndexBeforeLoad).toHaveBeenCalledTimes(1)
    })

    test('when updating the initial router context value in a regular route', async () => {
      const mockIndexBeforeLoad = vi.fn()

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        context: ({ context }) => ({ ...context, project: 'Query' }),
        beforeLoad: ({ context }) => {
          mockIndexBeforeLoad(context)
        },
        component: () => <div>Index page</div>,
      })
      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({
        routeTree,
        history,
        context: { project: 'foo' },
      })

      render(<RouterProvider router={router} />)

      const indexElement = await screen.findByText('Index page')
      expect(indexElement).toBeInTheDocument()

      expect(mockIndexBeforeLoad).toHaveBeenCalledWith({ project: 'Query' })
      expect(mockIndexBeforeLoad).toHaveBeenCalledTimes(1)
    })

    test('when returning an empty object in the root route', async () => {
      const mock = vi.fn()

      const rootRoute = createRootRoute({
        context: () => ({}),
        beforeLoad: ({ context }) => {
          mock(context)
        },
        component: () => <div>Root page</div>,
      })
      const routeTree = rootRoute.addChildren([])
      const router = createRouter({
        routeTree,
        history,
        context: { project: 'foo' },
      })

      render(<RouterProvider router={router} />)

      const rootElement = await screen.findByText('Root page')
      expect(rootElement).toBeInTheDocument()

      expect(mock).toHaveBeenCalledWith({ project: 'foo' })
      expect(mock).toHaveBeenCalledTimes(1)
    })

    test('when updating the initial router context value in the parent route and in the child route', async () => {
      const mockRootBeforeLoad = vi.fn()
      const mockIndexBeforeLoad = vi.fn()

      const rootRoute = createRootRoute({
        context: ({ context }) => ({ ...context, project: 'Router' }),
        beforeLoad: ({ context }) => {
          mockRootBeforeLoad(context)
        },
        component: () => (
          <div>
            Root page <Outlet />
          </div>
        ),
      })
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        context: ({ context }) => ({ ...context, project: 'Query' }),
        beforeLoad: ({ context }) => {
          mockIndexBeforeLoad(context)
        },
        component: () => <div>Index page</div>,
      })
      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({
        routeTree,
        history,
        context: { project: 'bar' },
      })

      render(<RouterProvider router={router} />)

      const indexElement = await screen.findByText('Index page')
      expect(indexElement).toBeInTheDocument()

      expect(mockRootBeforeLoad).toHaveBeenCalledWith({ project: 'Router' })
      expect(mockRootBeforeLoad).toHaveBeenCalledTimes(1)

      expect(mockIndexBeforeLoad).toHaveBeenCalledWith({ project: 'Query' })
      expect(mockIndexBeforeLoad).toHaveBeenCalledTimes(1)
    })
  })

  describe('return values being available in loader', () => {
    test('when returning an empty object in a regular route', async () => {
      const mockIndexLoader = vi.fn()

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        context: () => ({}),
        loader: ({ context }) => {
          mockIndexLoader(context)
        },
        component: () => <div>Index page</div>,
      })
      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({
        routeTree,
        history,
        context: { project: 'foo' },
      })

      render(<RouterProvider router={router} />)

      const rootElement = await screen.findByText('Index page')
      expect(rootElement).toBeInTheDocument()

      expect(mockIndexLoader).toHaveBeenCalledWith({ project: 'foo' })
      expect(mockIndexLoader).toHaveBeenCalledTimes(1)
    })

    test('when updating the initial router context value in a regular route', async () => {
      const mockIndexLoader = vi.fn()

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        context: ({ context }) => ({ ...context, project: 'Query' }),
        loader: ({ context }) => {
          mockIndexLoader(context)
        },
        component: () => <div>Index page</div>,
      })
      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({
        routeTree,
        history,
        context: { project: 'foo' },
      })

      render(<RouterProvider router={router} />)

      const indexElement = await screen.findByText('Index page')
      expect(indexElement).toBeInTheDocument()

      expect(mockIndexLoader).toHaveBeenCalledWith({ project: 'Query' })
      expect(mockIndexLoader).toHaveBeenCalledTimes(1)
    })

    test('when returning an empty object in the root route', async () => {
      const mockRootLoader = vi.fn()

      const rootRoute = createRootRoute({
        context: () => ({}),
        loader: ({ context }) => {
          mockRootLoader(context)
        },
        component: () => <div>Root page</div>,
      })
      const routeTree = rootRoute.addChildren([])
      const router = createRouter({
        routeTree,
        history,
        context: { project: 'foo' },
      })

      render(<RouterProvider router={router} />)

      const rootElement = await screen.findByText('Root page')
      expect(rootElement).toBeInTheDocument()

      expect(mockRootLoader).toHaveBeenCalledWith({ project: 'foo' })
      expect(mockRootLoader).toHaveBeenCalledTimes(1)
    })

    test('when updating the initial router context value in the root route and in the child route', async () => {
      const mockRootLoader = vi.fn()
      const mockIndexLoader = vi.fn()

      const rootRoute = createRootRoute({
        context: ({ context }) => ({ ...context, project: 'Router' }),
        loader: ({ context }) => {
          mockRootLoader(context)
        },
        component: () => (
          <div>
            Root page <Outlet />
          </div>
        ),
      })
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        context: ({ context }) => ({ ...context, project: 'Query' }),
        loader: ({ context }) => {
          mockIndexLoader(context)
        },
        component: () => <div>Index page</div>,
      })
      const routeTree = rootRoute.addChildren([indexRoute])
      const router = createRouter({
        routeTree,
        history,
        context: { project: 'bar' },
      })

      render(<RouterProvider router={router} />)

      const indexElement = await screen.findByText('Index page')
      expect(indexElement).toBeInTheDocument()

      expect(mockRootLoader).toHaveBeenCalledWith({ project: 'Router' })
      expect(mockRootLoader).toHaveBeenCalledTimes(1)

      expect(mockIndexLoader).toHaveBeenCalledWith({ project: 'Query' })
      expect(mockIndexLoader).toHaveBeenCalledTimes(1)
    })
  })
})

describe('beforeLoad in the route definition', () => {
  // Present at the root route
  test('route context, present in the root route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute({
      beforeLoad: ({ context }) => {
        mock(context)
      },
      component: () => <div>Root page</div>,
    })
    const routeTree = rootRoute.addChildren([])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const rootElement = await screen.findByText('Root page')
    expect(rootElement).toBeInTheDocument()

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('route context (sleep), present in the root route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute({
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Root page</div>,
    })
    const routeTree = rootRoute.addChildren([])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const rootElement = await screen.findByText('Root page')
    expect(rootElement).toBeInTheDocument()

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Present at the index route
  test('route context, present in the index route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      beforeLoad: ({ context }) => {
        mock(context)
      },
      component: () => <div>Index page</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const indexElement = await screen.findByText('Index page')
    expect(indexElement).toBeInTheDocument()

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('route context (sleep), present in the index route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Index page</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const indexElement = await screen.findByText('Index page')
    expect(indexElement).toBeInTheDocument()

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context that is updated at the root, is the same in the index route
  test('modified route context, present in the index route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute({
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return {
          ...context,
          foo: 'sean',
        }
      },
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Index page</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const indexElement = await screen.findByText('Index page')
    expect(indexElement).toBeInTheDocument()

    expect(mock).toHaveBeenCalledWith({ foo: 'sean' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context the context is available after a redirect on first-load
  test('on first-load, route context is present in the /about route after a redirect is thrown in the beforeLoad of the index route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/about' })
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>About page</div>,
    })
    const routeTree = rootRoute.addChildren([aboutRoute, indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const aboutElement = await screen.findByText('About page')
    expect(aboutElement).toBeInTheDocument()

    expect(window.location.pathname).toBe('/about')
    expect(router.state.location.pathname).toBe('/about')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('on first-load, route context is present in the /about route after a redirect is thrown in the loader of the index route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/about' })
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>About page</div>,
    })
    const routeTree = rootRoute.addChildren([aboutRoute, indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const aboutElement = await screen.findByText('About page')
    expect(aboutElement).toBeInTheDocument()

    expect(window.location.pathname).toBe('/about')
    expect(router.state.location.pathname).toBe('/about')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context the context is available after a redirect on navigate
  test('on navigate, route context is present in the /person route after a redirect is thrown in the beforeLoad of the /about route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/person',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      personRoute,
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(window.location.pathname).toBe('/person')
    expect(router.state.location.pathname).toBe('/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('on navigate, route context is present in the /person route after a redirect is thrown in the loader of the /about route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/person',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      personRoute,
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(window.location.pathname).toBe('/person')
    expect(router.state.location.pathname).toBe('/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context returned by /nested/about, is the same as its parent route /nested on navigate
  test('nested destination on navigate, route context in the /nested/about route is correctly inherited from the /nested parent', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/nested/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'nested' }
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/about',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>About page</div>,
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([aboutRoute]),
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const aboutElement = await screen.findByText('About page')
    expect(aboutElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/nested/about')
    expect(window.location.pathname).toBe('/nested/about')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'nested' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context returned by /nested/person route, is the same as its parent route /nested on navigate after a redirect /about
  test('nested destination on navigate, when a redirect is thrown in beforeLoad in /about, the /nested/person route context is correctly inherited from its parent /nested', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/nested/person' })
      },
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'nested' }
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/person',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/nested/person')
    expect(window.location.pathname).toBe('/nested/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'nested' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('nested destination on navigate, when a redirect is thrown in loader in /about, the /nested/person route context is correctly inherited from parent /nested', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/nested/person' })
      },
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'nested' }
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/person',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/nested/person')
    expect(window.location.pathname).toBe('/nested/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'nested' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context returned by a layout route, is the same its child route (index route) on first-load
  test('_layout on first-load, route context in the index route is correctly inherited from the layout parent', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
    })
    const indexRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Index page</div>,
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([indexRoute]),
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const indexElement = await screen.findByText('Index page')
    expect(indexElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/')
    expect(window.location.pathname).toBe('/')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'layout' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context returned by a layout route, is the same its child route (about route) on navigate
  test('_layout on navigate, route context in the /about route is correctly inherited from the layout parent', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/about',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>About page</div>,
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([aboutRoute]),
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const aboutElement = await screen.findByText('About page')
    expect(aboutElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/about')
    expect(window.location.pathname).toBe('/about')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'layout' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context returned by a layout route, is the same its child route (about route) on after a redirect on navigate
  test('_layout on navigate, when a redirect is thrown in beforeLoad in /about, the /person route context is correctly inherited from the layout parent', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/person',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/person')
    expect(window.location.pathname).toBe('/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'layout' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('_layout on navigate, when a redirect is thrown in loader in /about, the /person route context is correctly inherited from the layout parent', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/person',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/person')
    expect(window.location.pathname).toBe('/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'layout' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('child route receives updated values after the values were previously returned by the child route and then updated by the parent route', async () => {
    const mockIndexBeforeLoadFn = vi.fn()
    let counter = 0

    const rootRoute = createRootRoute({
      beforeLoad: () => {
        counter++
        return {
          counter,
        }
      },
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      beforeLoad: ({ context }) => {
        mockIndexBeforeLoadFn(context)
        return {
          counter: context.counter,
        }
      },
      component: () => {
        const context = indexRoute.useRouteContext()
        return (
          <div>
            <span data-testid="index-page">Index page</span>
            <span data-testid="counter">{context.value.counter}</span>
          </div>
        )
      },
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history })

    render(<RouterProvider router={router} />)

    const rootElement = await screen.findByTestId('index-page')
    expect(rootElement).toBeInTheDocument()

    async function check(expectedCounter: number) {
      const counterElement = await screen.findByTestId('counter')
      expect(counterElement).toHaveTextContent(`${expectedCounter}`)

      expect(mockIndexBeforeLoadFn).toHaveBeenCalledWith({
        counter: expectedCounter,
      })
    }

    await check(1)
    await router.invalidate()
    await check(2)
  })
})

describe('loader in the route definition', () => {
  // Present at the root route
  test('route context, present in the root route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute({
      loader: ({ context }) => {
        mock(context)
      },
      component: () => <div>Root page</div>,
    })
    const routeTree = rootRoute.addChildren([])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const rootElement = await screen.findByText('Root page')
    expect(rootElement).toBeInTheDocument()

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('route context (sleep), present in the root route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute({
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Root page</div>,
    })
    const routeTree = rootRoute.addChildren([])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const rootElement = await screen.findByText('Root page')
    expect(rootElement).toBeInTheDocument()

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Present at the index route
  test('route context, present in the index route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: ({ context }) => {
        mock(context)
      },
      component: () => <div>Index page</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const indexElement = await screen.findByText('Index page')
    expect(indexElement).toBeInTheDocument()

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('route context (sleep), present in the index route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Index page</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const indexElement = await screen.findByText('Index page')
    expect(indexElement).toBeInTheDocument()

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context that is updated at the root, is the same in the index route
  test('modified route context, present in the index route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute({
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return {
          ...context,
          foo: 'sean',
        }
      },
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Index page</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const indexElement = await screen.findByText('Index page')
    expect(indexElement).toBeInTheDocument()

    expect(mock).toHaveBeenCalledWith({ foo: 'sean' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // disabled test due to flakiness
  test.skip("on navigate (with preload using router methods), loader isn't invoked with undefined context if beforeLoad is pending when navigation happens", async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        return { mock }
      },
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        expect(context.mock).toBe(mock)
        context.mock()
      },
    })

    const routeTree = rootRoute.addChildren([aboutRoute, indexRoute])
    const router = createRouter({
      routeTree,
      history,
      context: { foo: 'bar' },
    })

    await router.load()

    // Don't await, simulate user clicking before preload is done
    router.preloadRoute(aboutRoute)

    await router.navigate(aboutRoute)
    await router.invalidate()

    // Expect only a single call as the one from preload and the one from navigate are deduped
    expect(mock).toHaveBeenCalledOnce()
  })

  test("on navigate (with preload), loader isn't invoked with undefined context if beforeLoad is pending when navigation happens", async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <div>
            <h1>Index page</h1>
            <Link to="/about" preload="intent">
              link to about
            </Link>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        return { mock }
      },
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        expect(context.mock).toBe(mock)
        context.mock()
      },
      component: () => <div>About page</div>,
    })

    const routeTree = rootRoute.addChildren([aboutRoute, indexRoute])
    const router = createRouter({
      routeTree,
      history,
      defaultPreload: 'intent',
      context: { foo: 'bar' },
    })

    render(<RouterProvider router={router} />)

    const linkToAbout = await screen.findByRole('link', {
      name: 'link to about',
    })
    expect(linkToAbout).toBeInTheDocument()

    // Don't await, simulate user clicking before preload is done
    fireEvent.focus(linkToAbout)
    fireEvent.click(linkToAbout)

    const aboutElement = await screen.findByText('About page')
    expect(aboutElement).toBeInTheDocument()

    expect(window.location.pathname).toBe('/about')

    // Expect only a single call as the one from preload and the one from navigate are deduped
    expect(mock).toHaveBeenCalledOnce()
  })

  // Check if context the context is available after a redirect on first-load
  test('on first-load, route context is present in the /about route after a redirect is thrown in beforeLoad of the index route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/about' })
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>About page</div>,
    })
    const routeTree = rootRoute.addChildren([aboutRoute, indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const aboutElement = await screen.findByText('About page')
    expect(aboutElement).toBeInTheDocument()

    expect(window.location.pathname).toBe('/about')
    expect(router.state.location.pathname).toBe('/about')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('on first-load, route context is present in the /about route after a redirect is thrown in loader of the index route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/about' })
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>About page</div>,
    })
    const routeTree = rootRoute.addChildren([aboutRoute, indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const aboutElement = await screen.findByText('About page')
    expect(aboutElement).toBeInTheDocument()

    expect(window.location.pathname).toBe('/about')
    expect(router.state.location.pathname).toBe('/about')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context the context is available after a redirect on navigate
  test('on navigate, route context is present in the /person route after a redirect is thrown in the beforeLoad of the /about route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/person',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      personRoute,
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(window.location.pathname).toBe('/person')
    expect(router.state.location.pathname).toBe('/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('on navigate, route context is present in the /person route after a redirect is thrown in the loader of the /about route', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/person',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      personRoute,
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(window.location.pathname).toBe('/person')
    expect(router.state.location.pathname).toBe('/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context returned by a /nested/about, is the same as its parent route /nested on navigate
  test('nested destination on navigate, route context in the /nested/about route is correctly inherited from the /nested parent', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/nested/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'nested' }
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/about',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>About page</div>,
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([aboutRoute]),
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const aboutElement = await screen.findByText('About page')
    expect(aboutElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/nested/about')
    expect(window.location.pathname).toBe('/nested/about')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'nested' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context returned by a /nested/person route, is the same as its parent route /nested on navigate after a redirect /about
  test('nested destination on navigate, when a redirect is thrown in beforeLoad in /about, the /nested/person route context is correctly inherited from its parent /nested', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/nested/person' })
      },
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'nested' }
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/person',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/nested/person')
    expect(window.location.pathname).toBe('/nested/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'nested' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('nested destination on navigate, when a redirect is thrown in loader in /about, the /nested/person route context is correctly inherited from parent /nested', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/nested/person' })
      },
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'nested' }
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/person',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/nested/person')
    expect(window.location.pathname).toBe('/nested/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'nested' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context returned by a layout route, is the same its child route (index route) on first-load
  test('_layout on first-load, route context in the index route is correctly inherited from the layout parent', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
    })
    const indexRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Index page</div>,
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([indexRoute]),
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const indexElement = await screen.findByText('Index page')
    expect(indexElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/')
    expect(window.location.pathname).toBe('/')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'layout' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context returned by a layout route, is the same its child route (about route) on navigate
  test('_layout on navigate, route context in the /about route is correctly inherited from the layout parent', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/about',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>About page</div>,
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([aboutRoute]),
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const aboutElement = await screen.findByText('About page')
    expect(aboutElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/about')
    expect(window.location.pathname).toBe('/about')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'layout' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  // Check if context returned by a layout route, is the same its child route (about route) on after a redirect on navigate
  test('_layout on navigate, when a redirect is thrown in beforeLoad in /about, the /person route context is correctly inherited from the layout parent', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/person',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/person')
    expect(window.location.pathname).toBe('/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'layout' })
    expect(mock).toHaveBeenCalledTimes(1)
  })

  test('_layout on navigate, when a redirect is thrown in loader in /about, the /person route context is correctly inherited from the layout parent', async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const navigate = indexRoute.useNavigate()
        return (
          <div>
            <h1>Index page</h1>
            <button
              onClick={() => {
                navigate({ to: '/about' })
              }}
            >
              button to about
            </button>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/person',
      loader: async ({ context }) => {
        await sleep(WAIT_TIME)
        mock(context)
      },
      component: () => <div>Person page</div>,
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const buttonToAbout = await screen.findByRole('button', {
      name: 'button to about',
    })
    expect(buttonToAbout).toBeInTheDocument()
    fireEvent.click(buttonToAbout)

    const personElement = await screen.findByText('Person page')
    expect(personElement).toBeInTheDocument()

    expect(router.state.location.href).toBe('/person')
    expect(window.location.pathname).toBe('/person')

    expect(mock).toHaveBeenCalledWith({ foo: 'bar', layout: 'layout' })
    expect(mock).toHaveBeenCalledTimes(1)
  })
})

describe('useRouteContext in the component', () => {
  // Present at the root route
  test('route context, present in the root route', async () => {
    const rootRoute = createRootRoute({
      component: () => {
        const context = rootRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(JSON.stringify({ foo: 'bar' }))

    expect(content).toBeInTheDocument()
  })

  test('route context (sleep in beforeLoad), present in the root route', async () => {
    const rootRoute = createRootRoute({
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
      },
      component: () => {
        const context = rootRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(JSON.stringify({ foo: 'bar' }))

    expect(content).toBeInTheDocument()
  })

  test('route context (sleep in loader), present root route', async () => {
    const rootRoute = createRootRoute({
      loader: async () => {
        await sleep(WAIT_TIME)
      },
      component: () => {
        const context = rootRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(JSON.stringify({ foo: 'bar' }))

    expect(content).toBeInTheDocument()
  })

  // Present at the index route
  test('route context, present in the index route', async () => {
    const rootRoute = createRootRoute({})
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const context = indexRoute.useRouteContext()

        if (context === undefined) {
          throw new Error('context is undefined')
        }
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(JSON.stringify({ foo: 'bar' }))

    expect(content).toBeInTheDocument()
  })

  test('route context (sleep in beforeLoad), present in the index route', async () => {
    const rootRoute = createRootRoute({})
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
      },
      component: () => {
        const context = indexRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(JSON.stringify({ foo: 'bar' }))

    expect(content).toBeInTheDocument()
  })

  test('route context (sleep in loader), present in the index route', async () => {
    const rootRoute = createRootRoute({})
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: async () => {
        await sleep(WAIT_TIME)
      },
      component: () => {
        const context = indexRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(JSON.stringify({ foo: 'bar' }))

    expect(content).toBeInTheDocument()
  })

  // Check if context that is updated at the root, is the same in the root route
  test('modified route context, present in the root route', async () => {
    const rootRoute = createRootRoute({
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return {
          ...context,
          foo: 'sean',
        }
      },
      component: () => {
        const context = rootRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })

    const routeTree = rootRoute.addChildren([])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(JSON.stringify({ foo: 'sean' }))

    expect(content).toBeInTheDocument()
  })

  // Check if the context that is updated at the root, is the same in the index route
  test('modified route context, present in the index route', async () => {
    const rootRoute = createRootRoute({
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return {
          ...context,
          foo: 'sean',
        }
      },
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const context = indexRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(JSON.stringify({ foo: 'sean' }))

    expect(content).toBeInTheDocument()
  })

  // Check if the context that is available after a redirect on first-load
  test('on first-load, route context is present in the /about route after a redirect is thrown in the beforeLoad of the index route', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/about' })
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      component: () => {
        const context = aboutRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([aboutRoute, indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(JSON.stringify({ foo: 'bar' }))

    expect(router.state.location.href).toBe('/about')
    expect(window.location.pathname).toBe('/about')

    expect(content).toBeInTheDocument()
  })

  test('on first-load, route context is present in the /about route after a redirect is thrown in the loader of the index route', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/about' })
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      component: () => {
        const context = aboutRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([aboutRoute, indexRoute])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(JSON.stringify({ foo: 'bar' }))

    expect(router.state.location.href).toBe('/about')
    expect(window.location.pathname).toBe('/about')

    expect(content).toBeInTheDocument()
  })

  // Check if the context that is available after a redirect on navigate
  test('on navigate, route context is present in the /person route after a redirect is thrown in the beforeLoad of the /about route', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <div>
            <h1>Index page</h1>
            <Link to="/about">link to about</Link>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/person',
      component: () => {
        const context = personRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([
      personRoute,
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const linkToAbout = await screen.findByRole('link', {
      name: 'link to about',
    })
    expect(linkToAbout).toBeInTheDocument()
    fireEvent.click(linkToAbout)

    const content = await screen.findByText(JSON.stringify({ foo: 'bar' }))
    expect(content).toBeInTheDocument()

    expect(router.state.location.href).toBe('/person')
    expect(window.location.pathname).toBe('/person')
  })

  test('on navigate, route context is present in the /person route after a redirect is thrown in the loader of the /about route', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <div>
            <h1>Index page</h1>
            <Link to="/about">link to about</Link>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const personRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/person',
      component: () => {
        const context = personRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([
      personRoute,
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const linkToAbout = await screen.findByRole('link', {
      name: 'link to about',
    })
    expect(linkToAbout).toBeInTheDocument()
    fireEvent.click(linkToAbout)

    const content = await screen.findByText(JSON.stringify({ foo: 'bar' }))
    expect(content).toBeInTheDocument()

    expect(router.state.location.href).toBe('/person')
    expect(window.location.pathname).toBe('/person')
  })

  // Check if context returned by /nested/about, is the same its parent /nested on navigate
  test('nested destination on navigate, route context in the /nested/about route is correctly inherited from its parent /nested', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <div>
            <h1>Index page</h1>
            <Link to="/nested/about">link to about</Link>
          </div>
        )
      },
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'nested' }
      },
      component: () => <Outlet />,
    })
    const aboutRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/about',
      component: () => {
        const context = aboutRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([aboutRoute]),
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const linkToAbout = await screen.findByRole('link', {
      name: 'link to about',
    })

    expect(linkToAbout).toBeInTheDocument()
    fireEvent.click(linkToAbout)

    const content = await screen.findByText(
      JSON.stringify({ foo: 'bar', layout: 'nested' }),
    )

    expect(router.state.location.href).toBe('/nested/about')
    expect(window.location.pathname).toBe('/nested/about')

    expect(content).toBeInTheDocument()
  })

  // Check if context returned by a layout route, is the same its child route (about route) on after a redirect on navigate
  test('nested destination on navigate, when a redirect is thrown in beforeLoad in /about, the /nested/person route context is correctly inherited from its parent /nested', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <div>
            <h1>Index page</h1>
            <Link to="/about">link to about</Link>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/nested/person' })
      },
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'nested' }
      },
      component: () => <Outlet />,
    })
    const personRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/person',
      component: () => {
        const context = personRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const linkToAbout = await screen.findByRole('link', {
      name: 'link to about',
    })
    expect(linkToAbout).toBeInTheDocument()
    fireEvent.click(linkToAbout)

    const content = await screen.findByText(
      JSON.stringify({ foo: 'bar', layout: 'nested' }),
    )

    expect(router.state.location.href).toBe('/nested/person')
    expect(window.location.pathname).toBe('/nested/person')

    expect(content).toBeInTheDocument()
  })

  test('nested destination on navigate, when a redirect is thrown in loader in /about, the /nested/person route context is correctly inherited from its parent /nested', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <div>
            <h1>Index page</h1>
            <Link to="/about">link to about</Link>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/nested/person' })
      },
    })
    const nestedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/nested',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'nested' }
      },
      component: () => <Outlet />,
    })
    const personRoute = createRoute({
      getParentRoute: () => nestedRoute,
      path: '/person',
      component: () => {
        const context = personRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([
      nestedRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const linkToAbout = await screen.findByRole('link', {
      name: 'link to about',
    })
    expect(linkToAbout).toBeInTheDocument()
    fireEvent.click(linkToAbout)

    const content = await screen.findByText(
      JSON.stringify({ foo: 'bar', layout: 'nested' }),
    )

    expect(router.state.location.href).toBe('/nested/person')
    expect(window.location.pathname).toBe('/nested/person')

    expect(content).toBeInTheDocument()
  })

  // Check if context returned by a layout route, is the same its child route (index route) on first-load
  test('_layout on first-load, route context in the index route is correctly inherited from the layout parent', async () => {
    const rootRoute = createRootRoute()
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
      component: () => <Outlet />,
    })
    const indexRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/',
      component: () => {
        const context = indexRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([indexRoute]),
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const content = await screen.findByText(
      JSON.stringify({ foo: 'bar', layout: 'layout' }),
    )

    expect(router.state.location.href).toBe('/')
    expect(window.location.pathname).toBe('/')

    expect(content).toBeInTheDocument()
  })

  // Check if context returned by a layout route, is the same its child route (about route) on navigate
  test('_layout on navigate, route context in the /about route is correctly inherited from the layout parent', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <div>
            <h1>Index page</h1>
            <Link to="/about">link to about</Link>
          </div>
        )
      },
    })
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
      component: () => <Outlet />,
    })
    const aboutRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/about',
      component: () => {
        const context = aboutRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([aboutRoute]),
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const linkToAbout = await screen.findByRole('link', {
      name: 'link to about',
    })
    expect(linkToAbout).toBeInTheDocument()
    fireEvent.click(linkToAbout)

    const content = await screen.findByText(
      JSON.stringify({ foo: 'bar', layout: 'layout' }),
    )

    expect(router.state.location.href).toBe('/about')
    expect(window.location.pathname).toBe('/about')

    expect(content).toBeInTheDocument()
  })

  // Check if context returned by a layout route, is the same its child route (about route) on after a redirect on navigate
  test('_layout on navigate, when a redirect is thrown in beforeLoad in /about, the /person route context is correctly inherited from the layout parent', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <div>
            <h1>Index page</h1>
            <Link to="/about">link to about</Link>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      beforeLoad: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
      component: () => <Outlet />,
    })
    const personRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/person',
      component: () => {
        const context = personRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const linkToAbout = await screen.findByRole('link', {
      name: 'link to about',
    })
    expect(linkToAbout).toBeInTheDocument()
    fireEvent.click(linkToAbout)

    const content = await screen.findByText(
      JSON.stringify({ foo: 'bar', layout: 'layout' }),
    )

    expect(router.state.location.href).toBe('/person')
    expect(window.location.pathname).toBe('/person')

    expect(content).toBeInTheDocument()
  })

  test('_layout on navigate, when a redirect is thrown in loader in /about, the /person route context is correctly inherited from the layout parent', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <div>
            <h1>Index page</h1>
            <Link to="/about">link to about</Link>
          </div>
        )
      },
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      loader: async () => {
        await sleep(WAIT_TIME)
        throw redirect({ to: '/person' })
      },
    })
    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      beforeLoad: async ({ context }) => {
        await sleep(WAIT_TIME)
        return { ...context, layout: 'layout' }
      },
      component: () => <Outlet />,
    })
    const personRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/person',
      component: () => {
        const context = personRoute.useRouteContext()
        return <div>{JSON.stringify(context.value)}</div>
      },
    })
    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([personRoute]),
      aboutRoute,
      indexRoute,
    ])
    const router = createRouter({ routeTree, history, context: { foo: 'bar' } })

    render(<RouterProvider router={router} />)

    const linkToAbout = await screen.findByRole('link', {
      name: 'link to about',
    })
    expect(linkToAbout).toBeInTheDocument()
    fireEvent.click(linkToAbout)

    const content = await screen.findByText(
      JSON.stringify({ foo: 'bar', layout: 'layout' }),
    )

    expect(router.state.location.href).toBe('/person')
    expect(window.location.pathname).toBe('/person')

    expect(content).toBeInTheDocument()
  })
})
