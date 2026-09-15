import React from 'react'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import {
  RouterProvider,
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  getRouteApi,
  notFound,
} from '../src'
import type { RouterHistory } from '../src'

let history: RouterHistory

beforeEach(() => {
  history = createBrowserHistory()
  expect(window.location.pathname).toBe('/')
})

afterEach(() => {
  history.destroy()
  vi.resetAllMocks()
  window.history.replaceState(null, 'root', '/')
  cleanup()
})

describe('getRouteApi', () => {
  it('should have the useMatch hook', () => {
    const api = getRouteApi('foo')
    expect(api.useMatch).toBeDefined()
  })

  it('should have the useRouteContext hook', () => {
    const api = getRouteApi('foo')
    expect(api.useRouteContext).toBeDefined()
  })

  it('should have the useSearch hook', () => {
    const api = getRouteApi('foo')
    expect(api.useSearch).toBeDefined()
  })

  it('should have the useParams hook', () => {
    const api = getRouteApi('foo')
    expect(api.useParams).toBeDefined()
  })

  it('should have the useLoaderData hook', () => {
    const api = getRouteApi('foo')
    expect(api.useLoaderData).toBeDefined()
  })

  it('should have the useLoaderDeps hook', () => {
    const api = getRouteApi('foo')
    expect(api.useLoaderDeps).toBeDefined()
  })

  it('should have the useNavigate hook', () => {
    const api = getRouteApi('foo')
    expect(api.useNavigate).toBeDefined()
  })
})

describe('createRoute has the same hooks as getRouteApi', () => {
  const routeApi = getRouteApi('foo')
  const hookNames = Object.keys(routeApi).filter((key) => key.startsWith('use'))
  const route = createRoute({} as any)

  it.each(hookNames.map((name) => [name]))(
    'should have the "%s" hook defined',
    (hookName) => {
      expect(route[hookName as keyof typeof route]).toBeDefined()
    },
  )
})

/* disabled until HMR bug is fixed 
describe('throws invariant exception when trying to access properties before `createRouter` completed', () => {
  function setup() {
    const rootRoute = createRootRoute()

    const IndexComponent = () => {
      const navigate = useNavigate()
      return (
        <>
          <h1>Index</h1>
          <button onClick={() => navigate({ to: '/' })}>Index</button>
          <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
        </>
      )
    }

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: IndexComponent,
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => {
        return (
          <>
            <h1>Posts</h1>
          </>
        )
      },
    })
    const initRouter = () =>
      createRouter({
        routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
      })
    return { initRouter, rootRoute, indexRoute, postsRoute }
  }

  it('to', () => {
    const { initRouter, indexRoute, postsRoute } = setup()

    const expectedError = `Invariant failed: trying to access property 'to' on a route which is not initialized yet. Route properties are only available after 'createRouter' completed.`
    expect(() => indexRoute.to).toThrowError(expectedError)
    expect(() => postsRoute.to).toThrowError(expectedError)

    initRouter()

    expect(indexRoute.to).toBe('/')
    expect(postsRoute.to).toBe('/posts')
  })

  it('fullPath', () => {
    const { initRouter, indexRoute, postsRoute } = setup()

    const expectedError = `trying to access property 'fullPath' on a route which is not initialized yet. Route properties are only available after 'createRouter' completed.`
    expect(() => indexRoute.fullPath).toThrowError(expectedError)
    expect(() => postsRoute.fullPath).toThrowError(expectedError)

    initRouter()

    expect(indexRoute.fullPath).toBe('/')
    expect(postsRoute.fullPath).toBe('/posts')
  })

  it('id', () => {
    const { initRouter, indexRoute, postsRoute } = setup()

    const expectedError = `Invariant failed: trying to access property 'id' on a route which is not initialized yet. Route properties are only available after 'createRouter' completed.`
    expect(() => indexRoute.id).toThrowError(expectedError)
    expect(() => postsRoute.id).toThrowError(expectedError)

    initRouter()

    expect(indexRoute.to).toBe('/')
    expect(postsRoute.to).toBe('/posts')
  })
})
*/

describe('onEnter event', () => {
  it('should have router context defined in router.load()', async () => {
    const fn = vi.fn()
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return <h1>Index</h1>
      },
      onEnter: ({ context }) => {
        fn(context)
      },
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, context: { foo: 'bar' }, history })

    await router.load()

    expect(fn).toHaveBeenCalledWith({ foo: 'bar' })
  })

  it('should have router context defined in <RouterProvider router={router} />', async () => {
    const fn = vi.fn()
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return <h1>Index</h1>
      },
      onEnter: ({ context }) => {
        fn(context)
      },
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, context: { foo: 'bar' }, history })

    render(<RouterProvider router={router} />)

    const indexElem = await screen.findByText('Index')
    expect(indexElem).toBeInTheDocument()

    expect(fn).toHaveBeenCalledWith({ foo: 'bar' })
  })
})

describe('route.head', () => {
  test('meta', async () => {
    const rootRoute = createRootRoute({
      head: () => ({
        meta: [
          { title: 'Root' },
          {
            charSet: 'utf-8',
          },
        ],
      }),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      head: () => ({
        meta: [{ title: 'Index' }],
      }),
      component: () => <div>Index</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history })
    render(<RouterProvider router={router} />)
    const indexElem = await screen.findByText('Index')
    expect(indexElem).toBeInTheDocument()

    const metaState = router.state.matches.map((m) => m.meta)
    expect(metaState).toEqual([
      [
        { title: 'Root' },
        {
          charSet: 'utf-8',
        },
      ],
      [{ title: 'Index' }],
    ])
  })

  test('meta w/ loader', async () => {
    const rootRoute = createRootRoute({
      head: () => ({
        meta: [
          { title: 'Root' },
          {
            charSet: 'utf-8',
          },
        ],
      }),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      head: () => ({
        meta: [{ title: 'Index' }],
      }),
      loader: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
      },
      component: () => <div>Index</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history })
    render(<RouterProvider router={router} />)
    const indexElem = await screen.findByText('Index')
    expect(indexElem).toBeInTheDocument()

    const metaState = router.state.matches.map((m) => m.meta)
    expect(metaState).toEqual([
      [
        { title: 'Root' },
        {
          charSet: 'utf-8',
        },
      ],
      [{ title: 'Index' }],
    ])
  })

  test('meta is set when loader throws notFound', async () => {
    const rootRoute = createRootRoute({
      head: () => ({
        meta: [
          { title: 'Root' },
          {
            charSet: 'utf-8',
          },
        ],
      }),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      head: () => ({
        meta: [{ title: 'Index' }],
      }),
      loader: async () => {
        throw notFound()
      },
      component: () => <div>Index</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('Not Found')).toBeInTheDocument()

    const metaState = router.state.matches.map((m) => m.meta)
    expect(metaState).toEqual([
      [
        { title: 'Root' },
        {
          charSet: 'utf-8',
        },
      ],
      [{ title: 'Index' }],
    ])
  })

  test('meta is set when loader throws an error', async () => {
    const rootRoute = createRootRoute({
      head: () => ({
        meta: [
          { title: 'Root' },
          {
            charSet: 'utf-8',
          },
        ],
      }),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      head: () => ({
        meta: [{ title: 'Index' }],
      }),
      loader: async () => {
        throw new Error('Fly, you fools!')
      },
      component: () => <div>Index</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Fly, you fools!')).toBeInTheDocument()

    const metaState = router.state.matches.map((m) => m.meta)
    expect(metaState).toEqual([
      [
        { title: 'Root' },
        {
          charSet: 'utf-8',
        },
      ],
      [{ title: 'Index' }],
    ])
  })

  test('scripts', async () => {
    const rootRoute = createRootRoute({
      head: () => ({
        scripts: [{ src: 'root.js' }, { src: 'root2.js' }],
      }),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      head: () => ({
        scripts: [{ src: 'index.js' }],
      }),
      component: () => <div>Index</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history })
    render(<RouterProvider router={router} />)
    const indexElem = await screen.findByText('Index')
    expect(indexElem).toBeInTheDocument()

    const scriptsState = router.state.matches.map((m) => m.headScripts)
    expect(scriptsState).toEqual([
      [{ src: 'root.js' }, { src: 'root2.js' }],
      [{ src: 'index.js' }],
    ])
  })

  test('scripts w/ loader', async () => {
    const rootRoute = createRootRoute({
      head: () => ({
        scripts: [{ src: 'root.js' }, { src: 'root2.js' }],
      }),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      head: () => ({
        scripts: [{ src: 'index.js' }],
      }),
      loader: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
      },
      component: () => <div>Index</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history })
    render(<RouterProvider router={router} />)
    const indexElem = await screen.findByText('Index')
    expect(indexElem).toBeInTheDocument()

    const scriptsState = router.state.matches.map((m) => m.headScripts)
    expect(scriptsState).toEqual([
      [{ src: 'root.js' }, { src: 'root2.js' }],
      [{ src: 'index.js' }],
    ])
  })

  test('links', async () => {
    const rootRoute = createRootRoute({
      head: () => ({
        links: [{ href: 'root.css' }, { href: 'root2.css' }],
      }),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      head: () => ({
        links: [{ href: 'index.css' }],
      }),
      component: () => <div>Index</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history })
    render(<RouterProvider router={router} />)
    const indexElem = await screen.findByText('Index')
    expect(indexElem).toBeInTheDocument()

    const linksState = router.state.matches.map((m) => m.links)
    expect(linksState).toEqual([
      [{ href: 'root.css' }, { href: 'root2.css' }],
      [{ href: 'index.css' }],
    ])
  })

  test('links w/loader', async () => {
    const rootRoute = createRootRoute({
      head: () => ({
        links: [{ href: 'root.css' }, { href: 'root2.css' }],
      }),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      head: () => ({
        links: [{ href: 'index.css' }],
      }),
      loader: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
      },
      component: () => <div>Index</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history })
    render(<RouterProvider router={router} />)
    const indexElem = await screen.findByText('Index')
    expect(indexElem).toBeInTheDocument()

    const linksState = router.state.matches.map((m) => m.links)
    expect(linksState).toEqual([
      [{ href: 'root.css' }, { href: 'root2.css' }],
      [{ href: 'index.css' }],
    ])
  })

  test('styles', async () => {
    const rootRoute = createRootRoute({
      head: () => ({
        styles: [
          {
            media: 'all and (min-width: 200px)',
            children: '.inline-div { color: blue; }',
          },
        ],
      }),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      head: () => ({
        styles: [
          {
            media: 'all and (min-width: 100px)',
            children: '.inline-div { background-color: yellow; }',
          },
        ],
      }),
      component: () => <div className="inline-div">Index</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history })
    render(<RouterProvider router={router} />)
    const indexElem = await screen.findByText('Index')
    expect(indexElem).toBeInTheDocument()

    const stylesState = router.state.matches.map((m) => m.styles)
    expect(stylesState).toEqual([
      [
        {
          media: 'all and (min-width: 200px)',
          children: '.inline-div { color: blue; }',
        },
      ],
      [
        {
          media: 'all and (min-width: 100px)',
          children: '.inline-div { background-color: yellow; }',
        },
      ],
    ])
  })

  test('styles w/loader', async () => {
    const rootRoute = createRootRoute({
      head: () => ({
        styles: [
          {
            media: 'all and (min-width: 200px)',
            children: '.inline-div { color: blue; }',
          },
        ],
      }),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      head: () => ({
        styles: [
          {
            media: 'all and (min-width: 100px)',
            children: '.inline-div { background-color: yellow; }',
          },
        ],
      }),
      loader: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
      },
      component: () => <div className="inline-div">Index</div>,
    })
    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree, history })
    render(<RouterProvider router={router} />)
    const indexElem = await screen.findByText('Index')
    expect(indexElem).toBeInTheDocument()

    const stylesState = router.state.matches.map((m) => m.styles)
    expect(stylesState).toEqual([
      [
        {
          media: 'all and (min-width: 200px)',
          children: '.inline-div { color: blue; }',
        },
      ],
      [
        {
          media: 'all and (min-width: 100px)',
          children: '.inline-div { background-color: yellow; }',
        },
      ],
    ])
  })
})
