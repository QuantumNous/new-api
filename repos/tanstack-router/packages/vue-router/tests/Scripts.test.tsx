import { afterEach, describe, expect, test } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/vue'
import { Teleport } from 'vue'

import {
  HeadContent,
  Link,
  Outlet,
  RouterProvider,
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'
import { Scripts } from '../src/Scripts'
import type { Manifest } from '@tanstack/router-core'

const createTestManifest = (
  routeId: string,
  options?: { scriptFormat?: Manifest['scriptFormat'] },
) =>
  ({
    ...(options?.scriptFormat ? { scriptFormat: options.scriptFormat } : {}),
    routes: {
      [routeId]: {
        preloads: ['/main.js'],
        css: ['/main.css'],
      },
    },
  }) satisfies Manifest

const browserHistories: Array<ReturnType<typeof createBrowserHistory>> = []

const createTestBrowserHistory = () => {
  const history = createBrowserHistory()
  browserHistories.push(history)
  return history
}

afterEach(() => {
  cleanup()
  browserHistories.splice(0).forEach((history) => history.destroy())
  window.history.replaceState(null, 'root', '/')
})

describe('ssr scripts', () => {
  test('it works', async () => {
    const rootRoute = createRootRoute({
      // loader: () => new Promise((r) => setTimeout(r, 1)),
      head: () => {
        return {
          scripts: [
            {
              src: 'script.js',
            },
            {
              src: 'script2.js',
            },
          ],
        }
      },
      component: () => {
        return <Scripts />
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      // loader: () => new Promise((r) => setTimeout(r, 2)),
      head: () => {
        return {
          scripts: [
            {
              src: 'script3.js',
            },
          ],
        }
      },
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    router.isServer = true

    await router.load()

    expect(router.state.matches.map((d) => d.headScripts).flat(1)).toEqual([
      { src: 'script.js' },
      { src: 'script2.js' },
      { src: 'script3.js' },
    ])
  })

  test('excludes `undefined` script values', async () => {
    const rootRoute = createRootRoute({
      scripts: () => [
        { src: 'script.js' },
        undefined, // 'script2.js' opted out by certain conditions, such as `NODE_ENV=production`.
      ],
      component: () => {
        return <Scripts />
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      scripts: () => [{ src: 'script3.js' }],
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
      isServer: true,
    })

    await router.load()

    expect(router.state.matches.map((d) => d.scripts).flat(1)).toEqual([
      { src: 'script.js' },
      undefined,
      { src: 'script3.js' },
    ])

    const { container } = render(<RouterProvider router={router} />)

    // Vue adds comment markers for fragments, so check scripts individually
    const scripts = container.querySelectorAll('script')
    expect(scripts.length).toBe(2)
    expect(scripts[0]!.getAttribute('src')).toBe('script.js')
    expect(scripts[1]!.getAttribute('src')).toBe('script3.js')
  })
})

describe('ssr HeadContent', () => {
  test('applies assetCrossOrigin to manifest stylesheets and preloads', async () => {
    const history = createTestBrowserHistory()

    const rootRoute = createRootRoute({
      component: () => (
        <>
          <Teleport to="head">
            <HeadContent
              assetCrossOrigin={{
                script: 'anonymous',
                stylesheet: 'use-credentials',
              }}
            />
          </Teleport>
          <Outlet />
        </>
      ),
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      component: () => <div>Index</div>,
    })

    const router = createRouter({
      history,
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    router.ssr = {
      manifest: createTestManifest(rootRoute.id),
    }

    await router.load()

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(document.head.querySelector('link[rel="stylesheet"]')).toBeTruthy()
      expect(
        document.head.querySelector('link[rel="modulepreload"]'),
      ).toBeTruthy()
    })

    expect(
      document.head
        .querySelector('link[rel="stylesheet"]')
        ?.getAttribute('crossorigin'),
    ).toBe('use-credentials')
    expect(
      document.head
        .querySelector('link[rel="modulepreload"]')
        ?.getAttribute('crossorigin'),
    ).toBe('anonymous')
  })

  test('does not duplicate SSR head links and cleans up preloads on unmount', async () => {
    const history = createTestBrowserHistory()

    const ssrStylesheet = document.createElement('link')
    ssrStylesheet.setAttribute('rel', 'stylesheet')
    ssrStylesheet.setAttribute('href', '/main.css')

    const ssrPreload = document.createElement('link')
    ssrPreload.setAttribute('rel', 'modulepreload')
    ssrPreload.setAttribute('href', '/main.js')

    document.head.append(ssrStylesheet, ssrPreload)

    try {
      const rootRoute = createRootRoute({
        component: () => (
          <>
            <Teleport to="head">
              <HeadContent />
            </Teleport>
            <Outlet />
          </>
        ),
      })

      const indexRoute = createRoute({
        path: '/',
        getParentRoute: () => rootRoute,
        component: () => <div>Index</div>,
      })

      const router = createRouter({
        history,
        routeTree: rootRoute.addChildren([indexRoute]),
      })

      router.ssr = {
        manifest: createTestManifest(rootRoute.id),
      }

      await router.load()

      const { unmount } = render(<RouterProvider router={router} />)

      await waitFor(() => {
        expect(
          document.head.querySelectorAll(
            'link[rel="stylesheet"][href="/main.css"]',
          ),
        ).toHaveLength(1)
        expect(
          document.head.querySelectorAll(
            'link[rel="modulepreload"][href="/main.js"]',
          ),
        ).toHaveLength(1)
      })

      expect(
        document.head.querySelector('link[rel="stylesheet"][href="/main.css"]'),
      ).toBe(ssrStylesheet)
      expect(
        document.head.querySelector(
          'link[rel="modulepreload"][href="/main.js"]',
        ),
      ).toBe(ssrPreload)

      unmount()

      await waitFor(() => {
        expect(
          document.head.querySelectorAll(
            'link[rel="stylesheet"][href="/main.css"]',
          ),
        ).toHaveLength(1)
        expect(
          document.head.querySelectorAll(
            'link[rel="modulepreload"][href="/main.js"]',
          ),
        ).toHaveLength(0)
      })
    } finally {
      ssrStylesheet.remove()
      ssrPreload.remove()
    }
  })

  test('removes preserved SSR-rendered route preload links after navigation', async () => {
    const history = createTestBrowserHistory()

    const ssrStylesheet = document.createElement('link')
    ssrStylesheet.setAttribute('rel', 'stylesheet')
    ssrStylesheet.setAttribute('href', '/index.css')

    const ssrPreload = document.createElement('link')
    ssrPreload.setAttribute('rel', 'modulepreload')
    ssrPreload.setAttribute('href', '/index.js')

    document.head.append(ssrStylesheet, ssrPreload)

    try {
      const rootRoute = createRootRoute({
        component: () => (
          <>
            <Teleport to="head">
              <HeadContent />
            </Teleport>
            <Outlet />
          </>
        ),
      })

      const indexRoute = createRoute({
        path: '/',
        getParentRoute: () => rootRoute,
        component: () => <Link to="/about">Go to about page</Link>,
      })

      const aboutRoute = createRoute({
        path: '/about',
        getParentRoute: () => rootRoute,
        component: () => <div>About</div>,
      })

      const router = createRouter({
        history,
        routeTree: rootRoute.addChildren([indexRoute, aboutRoute]),
      })

      router.ssr = {
        manifest: {
          routes: {
            [indexRoute.id]: {
              css: ['/index.css'],
              preloads: ['/index.js'],
            },
          },
        },
      }

      await router.load()

      render(<RouterProvider router={router} />)

      await waitFor(() => {
        expect(
          document.head.querySelectorAll(
            'link[rel="stylesheet"][href="/index.css"]',
          ),
        ).toHaveLength(1)
        expect(
          document.head.querySelectorAll(
            'link[rel="modulepreload"][href="/index.js"]',
          ),
        ).toHaveLength(1)
      })

      await fireEvent.click(
        screen.getByRole('link', { name: 'Go to about page' }),
      )

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/about')
      })

      await waitFor(() => {
        expect(
          document.head.querySelectorAll(
            'link[rel="stylesheet"][href="/index.css"]',
          ),
        ).toHaveLength(1)
        expect(
          document.head.querySelectorAll(
            'link[rel="modulepreload"][href="/index.js"]',
          ),
        ).toHaveLength(0)
      })
    } finally {
      document.head
        .querySelectorAll(
          'link[rel="stylesheet"][href="/index.css"], link[rel="modulepreload"][href="/index.js"]',
        )
        .forEach((element) => element.remove())
    }
  })

  test('does not reuse one SSR-rendered head link for multiple managed tags', async () => {
    const history = createTestBrowserHistory()

    const ssrStylesheet = document.createElement('link')
    ssrStylesheet.setAttribute('rel', 'stylesheet')
    ssrStylesheet.setAttribute('href', '/main.css')

    document.head.append(ssrStylesheet)

    try {
      const rootRoute = createRootRoute({
        head: () => ({
          links: [{ rel: 'stylesheet', href: '/main.css' }],
        }),
        component: () => (
          <>
            <Teleport to="head">
              <HeadContent />
            </Teleport>
            <Outlet />
          </>
        ),
      })

      const indexRoute = createRoute({
        path: '/',
        getParentRoute: () => rootRoute,
        component: () => <div>Index</div>,
      })

      const router = createRouter({
        history,
        routeTree: rootRoute.addChildren([indexRoute]),
      })

      router.ssr = {
        manifest: createTestManifest(rootRoute.id),
      }

      await router.load()

      render(<RouterProvider router={router} />)

      await waitFor(() => {
        expect(
          document.head.querySelectorAll(
            'link[rel="stylesheet"][href="/main.css"]',
          ),
        ).toHaveLength(2)
      })

      expect(
        document.head.querySelector('link[rel="stylesheet"][href="/main.css"]'),
      ).toBe(ssrStylesheet)
    } finally {
      document.head
        .querySelectorAll('link[rel="stylesheet"][href="/main.css"]')
        .forEach((element) => element.remove())
    }
  })

  test('does not preserve an SSR-rendered head link with stale attrs', async () => {
    const history = createTestBrowserHistory()

    const ssrStylesheet = document.createElement('link')
    ssrStylesheet.setAttribute('rel', 'stylesheet')
    ssrStylesheet.setAttribute('href', '/main.css')
    ssrStylesheet.setAttribute('crossorigin', 'anonymous')

    document.head.append(ssrStylesheet)

    try {
      const rootRoute = createRootRoute({
        component: () => (
          <>
            <Teleport to="head">
              <HeadContent
                assetCrossOrigin={{ stylesheet: 'use-credentials' }}
              />
            </Teleport>
            <Outlet />
          </>
        ),
      })

      const indexRoute = createRoute({
        path: '/',
        getParentRoute: () => rootRoute,
        component: () => <div>Index</div>,
      })

      const router = createRouter({
        history,
        routeTree: rootRoute.addChildren([indexRoute]),
      })

      router.ssr = {
        manifest: createTestManifest(rootRoute.id),
      }

      await router.load()

      render(<RouterProvider router={router} />)

      await waitFor(() => {
        expect(
          document.head.querySelector(
            'link[rel="stylesheet"][href="/main.css"][crossorigin="use-credentials"]',
          ),
        ).toBeTruthy()
      })

      expect(
        document.head.querySelector(
          'link[rel="stylesheet"][href="/main.css"][crossorigin="anonymous"]',
        ),
      ).toBe(ssrStylesheet)
    } finally {
      document.head
        .querySelectorAll('link[rel="stylesheet"][href="/main.css"]')
        .forEach((element) => element.remove())
    }
  })

  test('does not preserve an SSR-rendered head link with extra attrs', async () => {
    const history = createTestBrowserHistory()

    const ssrStylesheet = document.createElement('link')
    ssrStylesheet.setAttribute('rel', 'stylesheet')
    ssrStylesheet.setAttribute('href', '/main.css')
    ssrStylesheet.setAttribute('data-stale', '1')

    document.head.append(ssrStylesheet)

    try {
      const rootRoute = createRootRoute({
        component: () => (
          <>
            <Teleport to="head">
              <HeadContent />
            </Teleport>
            <Outlet />
          </>
        ),
      })

      const indexRoute = createRoute({
        path: '/',
        getParentRoute: () => rootRoute,
        component: () => <div>Index</div>,
      })

      const router = createRouter({
        history,
        routeTree: rootRoute.addChildren([indexRoute]),
      })

      router.ssr = {
        manifest: createTestManifest(rootRoute.id),
      }

      await router.load()

      render(<RouterProvider router={router} />)

      await waitFor(() => {
        expect(
          document.head.querySelectorAll(
            'link[rel="stylesheet"][href="/main.css"]',
          ),
        ).toHaveLength(2)
      })

      const links = Array.from(
        document.head.querySelectorAll(
          'link[rel="stylesheet"][href="/main.css"]',
        ),
      )
      expect(links).toContain(ssrStylesheet)
      expect(
        links.some(
          (element) =>
            element !== ssrStylesheet && !element.hasAttribute('data-stale'),
        ),
      ).toBe(true)
    } finally {
      document.head
        .querySelectorAll('link[rel="stylesheet"][href="/main.css"]')
        .forEach((element) => element.remove())
    }
  })

  test('renders runtime manifest inlineStyle', async () => {
    const history = createTestBrowserHistory()

    const rootRoute = createRootRoute({
      component: () => (
        <>
          <Teleport to="head">
            <HeadContent />
          </Teleport>
          <Outlet />
        </>
      ),
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      component: () => <div>Index</div>,
    })

    const router = createRouter({
      history,
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    router.ssr = {
      manifest: {
        inlineStyle: {
          attrs: { id: 'runtime-inline-style' },
          children: '.runtime{color:red}',
        },
        routes: {
          [rootRoute.id]: {},
        },
      },
    }

    await router.load()

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(
        document.head.querySelector('style#runtime-inline-style'),
      ).toBeTruthy()
    })

    expect(
      document.head.querySelector('style#runtime-inline-style')?.textContent,
    ).toBe('.runtime{color:red}')
  })

  test('renders preload as script links for iife manifest preloads', async () => {
    const history = createTestBrowserHistory()

    const rootRoute = createRootRoute({
      component: () => (
        <>
          <Teleport to="head">
            <HeadContent />
          </Teleport>
          <Outlet />
        </>
      ),
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      component: () => <div>Index</div>,
    })

    const router = createRouter({
      history,
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    router.ssr = {
      manifest: createTestManifest(rootRoute.id, { scriptFormat: 'iife' }),
    }

    await router.load()

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(
        document.head.querySelector('link[rel="preload"][as="script"]'),
      ).toBeTruthy()
    })

    expect(document.head.querySelector('link[rel="modulepreload"]')).toBeFalsy()
  })

  test('derives title, dedupes meta, and allows non-loader HeadContent', async () => {
    const rootRoute = createRootRoute({
      loader: () =>
        new Promise((r) => setTimeout(r, 1)).then(() => ({
          description: 'Root',
        })),
      head: ({ loaderData }) => {
        return {
          meta: [
            {
              title: 'Root',
            },
            {
              name: 'description',
              content: loaderData?.description,
            },
            {
              name: 'image',
              content: 'image.jpg',
            },
            {
              property: 'og:image',
              content: 'root-image.jpg',
            },
            {
              property: 'og:description',
              content: 'Root description',
            },
          ],
        }
      },
      component: () => {
        return <HeadContent />
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      loader: () =>
        new Promise((r) => setTimeout(r, 2)).then(() => ({
          description: 'Index',
        })),
      head: ({ loaderData }) => {
        return {
          meta: [
            {
              title: 'Index',
            },
            {
              name: 'description',
              content: loaderData?.description,
            },
            {
              name: 'last-modified',
              content: '2021-10-10',
            },
            {
              property: 'og:image',
              content: 'index-image.jpg',
            },
          ],
        }
      },
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    router.isServer = true

    await router.load()

    expect(router.state.matches.map((d) => d.meta).flat(1)).toEqual([
      { title: 'Root' },
      { name: 'description', content: 'Root' },
      { name: 'image', content: 'image.jpg' },
      { property: 'og:image', content: 'root-image.jpg' },
      { property: 'og:description', content: 'Root description' },
      { title: 'Index' },
      { name: 'description', content: 'Index' },
      { name: 'last-modified', content: '2021-10-10' },
      { property: 'og:image', content: 'index-image.jpg' },
    ])
  })

  test('keeps manifest stylesheet links mounted when history state changes', async () => {
    const history = createTestBrowserHistory()

    const rootRoute = createRootRoute({
      component: () => {
        return (
          <>
            <Teleport to="head">
              <HeadContent />
            </Teleport>
            <button
              onClick={() => {
                window.history.replaceState(
                  { slideId: 'slide-2' },
                  '',
                  window.location.href,
                )
              }}
            >
              Replace state
            </button>
            <Outlet />
          </>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      component: () => <div>Index</div>,
    })

    const router = createRouter({
      history,
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    router.ssr = {
      manifest: createTestManifest(rootRoute.id),
    }

    await router.load()

    render(<RouterProvider router={router} />)

    const getStylesheetLink = () =>
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
        (link) => link.getAttribute('href') === '/main.css',
      )

    await waitFor(() => {
      expect(getStylesheetLink()).toBeInstanceOf(HTMLLinkElement)
    })

    const initialLink = getStylesheetLink()
    expect(initialLink).toBeInstanceOf(HTMLLinkElement)

    await fireEvent.click(screen.getByRole('button', { name: 'Replace state' }))

    await waitFor(() => {
      expect(router.state.location.state).toMatchObject({
        slideId: 'slide-2',
      })
    })

    expect(getStylesheetLink()).toBe(initialLink)
    expect(
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(
        (link) => link.getAttribute('href') === '/main.css',
      ),
    ).toHaveLength(1)
  })

  test('keeps manifest stylesheet links mounted across repeated Link navigations', async () => {
    const history = createTestBrowserHistory()

    const rootRoute = createRootRoute({
      component: () => {
        return (
          <>
            <Teleport to="head">
              <HeadContent />
            </Teleport>
            <Outlet />
          </>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      component: () => <Link to="/about">Go to about page</Link>,
    })

    const aboutRoute = createRoute({
      path: '/about',
      getParentRoute: () => rootRoute,
      component: () => <Link to="/">Back to home</Link>,
    })

    const router = createRouter({
      history,
      routeTree: rootRoute.addChildren([indexRoute, aboutRoute]),
    })

    router.ssr = {
      manifest: createTestManifest(rootRoute.id),
    }

    await router.load()

    render(<RouterProvider router={router} />)

    const getStylesheetLink = () =>
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
        (link) => link.getAttribute('href') === '/main.css',
      )

    await waitFor(() => {
      expect(getStylesheetLink()).toBeInstanceOf(HTMLLinkElement)
    })

    const initialLink = getStylesheetLink()
    expect(initialLink).toBeInstanceOf(HTMLLinkElement)

    for (let i = 0; i < 5; i++) {
      await fireEvent.click(
        screen.getByRole('link', { name: 'Go to about page' }),
      )

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/about')
      })

      await screen.findByRole('link', { name: 'Back to home' })

      await fireEvent.click(screen.getByRole('link', { name: 'Back to home' }))

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/')
      })

      await screen.findByRole('link', { name: 'Go to about page' })
    }

    expect(getStylesheetLink()).toBe(initialLink)
    expect(
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(
        (link) => link.getAttribute('href') === '/main.css',
      ),
    ).toHaveLength(1)
  })
})
