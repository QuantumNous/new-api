import { afterEach, describe, expect, test } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { createPortal } from 'react-dom'
import ReactDOMServer from 'react-dom/server'

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

// React 19 keeps stylesheet resources keyed by href alive for the lifetime of
// the test module, so these tests use explicit asset URLs to avoid collisions
// between cases even though Testing Library cleanup runs after each test.
const createTestManifest = (
  routeId: string,
  options?: {
    stylesheetHref?: string
    preloadHref?: string
    scriptFormat?: Manifest['scriptFormat']
  },
) =>
  ({
    ...(options?.scriptFormat ? { scriptFormat: options.scriptFormat } : {}),
    routes: {
      [routeId]: {
        preloads: [options?.preloadHref ?? '/main.js'],
        css: [options?.stylesheetHref ?? '/main.css'],
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
        return (
          <div>
            <div data-testid="root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
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
      isServer: true,
    })

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
        return (
          <div>
            <div data-testid="root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      scripts: () => [{ src: 'script3.js' }],
      component: () => {
        return <div data-testid="index">index</div>
      },
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

    const { container } = await act(() =>
      render(<RouterProvider router={router} />),
    )
    expect(await screen.findByTestId('root')).toBeInTheDocument()
    expect(await screen.findByTestId('index')).toBeInTheDocument()

    expect(container.innerHTML).toEqual(
      `<div><div data-testid="root">root</div><div data-testid="index">index</div><script src="script.js"></script><script src="script3.js"></script></div>`,
    )
  })
})

describe('scripts with async/defer attributes', () => {
  test('server renders scripts with async/defer attributes in output', async () => {
    const rootRoute = createRootRoute({
      scripts: () => [
        {
          src: 'script.js',
          async: true,
        },
        {
          src: 'script2.js',
          defer: true,
        },
      ],
      component: () => {
        return (
          <div>
            <div data-testid="server-root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      component: () => {
        return <div data-testid="server-index">index</div>
      },
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
      isServer: true,
    })

    await router.load()

    // Use ReactDOMServer.renderToString to test actual server output
    const html = ReactDOMServer.renderToString(
      <RouterProvider router={router} />,
    )

    expect(html).toMatch(/<script[^>]*src="script\.js"[^>]*async=""/)
    expect(html).toMatch(/<script[^>]*src="script2\.js"[^>]*defer=""/)
  })

  test('server keeps manifest src scripts in document order', async () => {
    const clientEntryAsset = {
      attrs: {
        src: '/entry.js',
        type: 'module',
        async: true,
      },
    } satisfies NonNullable<Manifest['routes'][string]['scripts']>[number]

    const rootRoute = createRootRoute({
      component: () => {
        return (
          <html>
            <head />
            <body>
              <main data-testid="content">content</main>
              <Outlet />
              <Scripts />
            </body>
          </html>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
      isServer: true,
    })
    router.ssr = {
      manifest: {
        routes: {
          [rootRoute.id]: {
            scripts: [clientEntryAsset],
          },
        },
      },
    }

    await router.load()

    const html = ReactDOMServer.renderToString(
      <RouterProvider router={router} />,
    )
    const contentIndex = html.indexOf('<main data-testid="content">')
    const scriptIndex = html.indexOf('src="/entry.js"')

    expect(contentIndex).toBeGreaterThan(-1)
    expect(scriptIndex).toBeGreaterThan(contentIndex)
    expect(html).not.toContain('client-entry')
  })

  test('client renders scripts with attributes (including async/defer)', async () => {
    const rootRoute = createRootRoute({
      scripts: () => [
        {
          src: 'script.js',
          async: true,
          crossOrigin: 'anonymous',
        },
      ],
      component: () => {
        return (
          <div>
            <div data-testid="async-root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
      component: () => {
        return <div data-testid="async-index">index</div>
      },
    })

    // Clear head and any leftover body scripts between tests.
    document.head.innerHTML = ''
    document.querySelectorAll('body script').forEach((s) => s.remove())

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
      isServer: false, // Client-side rendering
    })

    await router.load()

    await act(() => render(<RouterProvider router={router} />))

    expect(await screen.findByTestId('async-root')).toBeInTheDocument()

    const script = document.querySelector('script[src="script.js"]')
    expect(script).toBeTruthy()

    // Attributes are preserved on the client.
    expect(script?.getAttribute('src')).toBe('script.js')
    expect(script?.hasAttribute('async')).toBe(true)
    expect(script?.getAttribute('crossorigin')).toBe('anonymous')
  })
})

describe('ssr HeadContent', () => {
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
      isServer: true,
    })

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

    const html = ReactDOMServer.renderToString(
      <RouterProvider router={router} />,
    )
    expect(html).toEqual(
      `<title>Index</title><meta name="image" content="image.jpg"/><meta property="og:description" content="Root description"/><meta name="description" content="Index"/><meta name="last-modified" content="2021-10-10"/><meta property="og:image" content="index-image.jpg"/>`,
    )
  })

  test('keeps manifest stylesheet links mounted when history state changes', async () => {
    const history = createTestBrowserHistory()
    const stylesheetHref = '/history-state.css'

    const rootRoute = createRootRoute({
      component: () => {
        return (
          <>
            {createPortal(<HeadContent />, document.head)}
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
      manifest: createTestManifest(rootRoute.id, {
        stylesheetHref,
      }),
    }

    await router.load()

    await act(() => render(<RouterProvider router={router} />))

    const getStylesheetLink = () =>
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
        (link) => link.getAttribute('href') === stylesheetHref,
      )

    await waitFor(() => {
      expect(getStylesheetLink()).toBeInstanceOf(HTMLLinkElement)
    })

    const initialLink = getStylesheetLink()
    expect(initialLink).toBeInstanceOf(HTMLLinkElement)

    fireEvent.click(screen.getByRole('button', { name: 'Replace state' }))

    await waitFor(() => {
      expect(router.state.location.state).toMatchObject({
        slideId: 'slide-2',
      })
    })

    expect(getStylesheetLink()).toBe(initialLink)
    expect(
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(
        (link) => link.getAttribute('href') === stylesheetHref,
      ),
    ).toHaveLength(1)
  })

  test('applies assetCrossOrigin to manifest stylesheets and preloads', async () => {
    const history = createTestBrowserHistory()
    const stylesheetHref = '/asset-cross-origin.css'
    const preloadHref = '/asset-cross-origin.js'

    const rootRoute = createRootRoute({
      component: () => {
        return (
          <>
            {createPortal(
              <HeadContent
                assetCrossOrigin={{
                  script: 'anonymous',
                  stylesheet: 'use-credentials',
                }}
              />,
              document.head,
            )}
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
      manifest: createTestManifest(rootRoute.id, {
        stylesheetHref,
        preloadHref,
      }),
    }

    await router.load()

    await act(() => render(<RouterProvider router={router} />))

    await waitFor(() => {
      expect(
        document.head.querySelector(
          `link[rel="stylesheet"][href="${stylesheetHref}"]`,
        ),
      ).toBeTruthy()
      expect(
        document.head.querySelector(
          `link[rel="modulepreload"][href="${preloadHref}"]`,
        ),
      ).toBeTruthy()
    })

    expect(
      document.head
        .querySelector(`link[rel="stylesheet"][href="${stylesheetHref}"]`)
        ?.getAttribute('crossorigin'),
    ).toBe('use-credentials')
    expect(
      document.head
        .querySelector(`link[rel="modulepreload"][href="${preloadHref}"]`)
        ?.getAttribute('crossorigin'),
    ).toBe('anonymous')
  })

  test('renders runtime manifest inlineStyle', async () => {
    const history = createTestBrowserHistory()

    const rootRoute = createRootRoute({
      component: () => {
        return (
          <>
            {createPortal(<HeadContent />, document.head)}
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

    await act(() => render(<RouterProvider router={router} />))

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
    const preloadHref = '/iife-preload.js'

    const rootRoute = createRootRoute({
      component: () => {
        return (
          <>
            {createPortal(<HeadContent />, document.head)}
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
      manifest: createTestManifest(rootRoute.id, {
        preloadHref,
        scriptFormat: 'iife',
      }),
    }

    await router.load()

    await act(() => render(<RouterProvider router={router} />))

    await waitFor(() => {
      expect(
        document.head.querySelector(
          `link[rel="preload"][as="script"][href="${preloadHref}"]`,
        ),
      ).toBeTruthy()
    })

    expect(
      document.head.querySelector(
        `link[rel="modulepreload"][href="${preloadHref}"]`,
      ),
    ).toBeFalsy()
  })

  test('assetCrossOrigin overrides manifest crossOrigin values', async () => {
    const history = createTestBrowserHistory()
    const stylesheetHref = '/override-cross-origin.css'
    const preloadHref = '/override-cross-origin.js'

    const rootRoute = createRootRoute({
      component: () => {
        return (
          <>
            {createPortal(
              <HeadContent assetCrossOrigin="anonymous" />,
              document.head,
            )}
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
      manifest: {
        routes: {
          [rootRoute.id]: {
            preloads: [
              { href: preloadHref, crossOrigin: 'use-credentials' as const },
            ],
            css: [
              {
                href: stylesheetHref,
                crossOrigin: 'use-credentials',
              },
            ],
          },
        },
      } as any,
    }

    await router.load()

    await act(() => render(<RouterProvider router={router} />))

    await waitFor(() => {
      expect(
        document.head.querySelector(
          `link[rel="stylesheet"][href="${stylesheetHref}"]`,
        ),
      ).toBeTruthy()
      expect(
        document.head.querySelector(
          `link[rel="modulepreload"][href="${preloadHref}"]`,
        ),
      ).toBeTruthy()
    })

    expect(
      document.head
        .querySelector(`link[rel="stylesheet"][href="${stylesheetHref}"]`)
        ?.getAttribute('crossorigin'),
    ).toBe('anonymous')
    expect(
      document.head
        .querySelector(`link[rel="modulepreload"][href="${preloadHref}"]`)
        ?.getAttribute('crossorigin'),
    ).toBe('anonymous')
  })

  test('keeps manifest stylesheet links mounted across repeated Link navigations', async () => {
    const history = createTestBrowserHistory()
    const stylesheetHref = '/repeated-nav.css'

    const rootRoute = createRootRoute({
      component: () => {
        return (
          <>
            {createPortal(<HeadContent />, document.head)}
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
      manifest: createTestManifest(rootRoute.id, {
        stylesheetHref,
      }),
    }

    await router.load()

    await act(() => render(<RouterProvider router={router} />))

    const getStylesheetLink = () =>
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
        (link) => link.getAttribute('href') === stylesheetHref,
      )

    await waitFor(() => {
      expect(getStylesheetLink()).toBeInstanceOf(HTMLLinkElement)
    })

    const initialLink = getStylesheetLink()
    expect(initialLink).toBeInstanceOf(HTMLLinkElement)

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('link', { name: 'Go to about page' }))

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/about')
      })

      await screen.findByRole('link', { name: 'Back to home' })

      fireEvent.click(screen.getByRole('link', { name: 'Back to home' }))

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/')
      })

      await screen.findByRole('link', { name: 'Go to about page' })
    }

    expect(getStylesheetLink()).toBe(initialLink)
    expect(
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(
        (link) => link.getAttribute('href') === stylesheetHref,
      ),
    ).toHaveLength(1)
  })
})

describe('data script rendering', () => {
  test('data script renders content on server (SSR)', async () => {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test Article',
    })

    const rootRoute = createRootRoute({
      scripts: () => [
        {
          type: 'application/ld+json',
          children: jsonLd,
        },
      ],
      component: () => {
        return (
          <div>
            <div data-testid="ssr-root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
      isServer: true,
    })

    await router.load()

    const html = ReactDOMServer.renderToString(
      <RouterProvider router={router} />,
    )

    expect(html).toContain('application/ld+json')
    expect(html).toContain(jsonLd)
  })

  test('data script preserves content on client', async () => {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Test',
    })

    const rootRoute = createRootRoute({
      scripts: () => [
        {
          type: 'application/ld+json',
          children: jsonLd,
        },
      ],
      component: () => {
        return (
          <div>
            <div data-testid="data-client-root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    await router.load()

    const { container } = await act(() =>
      render(<RouterProvider router={router} />),
    )

    const rootEl = container.querySelector('[data-testid="data-client-root"]')
    expect(rootEl).not.toBeNull()

    const scriptEl = container.querySelector(
      'script[type="application/ld+json"]',
    )
    expect(scriptEl).not.toBeNull()
    expect(scriptEl!.innerHTML).toBe(jsonLd)
  })

  test('executable script is injected into document.head via useEffect on client', async () => {
    const rootRoute = createRootRoute({
      scripts: () => [
        {
          children: 'console.log("hello")',
        },
      ],
      component: () => {
        return (
          <div>
            <div data-testid="exec-root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    await router.load()

    const { container } = await act(() =>
      render(<RouterProvider router={router} />),
    )

    const rootEl = container.querySelector('[data-testid="exec-root"]')
    expect(rootEl).not.toBeNull()

    // Executable inline scripts are injected into document.head via useEffect,
    // not rendered in the React tree on the client.
    const headScript = document.head.querySelector(
      'script:not([type]):not([src])',
    )
    expect(headScript).not.toBeNull()
    expect(headScript!.textContent).toBe('console.log("hello")')
  })

  test('module script is injected into document.head via useEffect on client', async () => {
    const rootRoute = createRootRoute({
      scripts: () => [
        {
          type: 'module',
          children: 'import { foo } from "./foo.js"',
        },
      ],
      component: () => {
        return (
          <div>
            <div data-testid="module-root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    await router.load()

    const { container } = await act(() =>
      render(<RouterProvider router={router} />),
    )

    const rootEl = container.querySelector('[data-testid="module-root"]')
    expect(rootEl).not.toBeNull()

    // Module scripts are injected into document.head via useEffect,
    // not rendered in the React tree on the client.
    const moduleScript = document.head.querySelector('script[type="module"]')
    expect(moduleScript).not.toBeNull()
    expect(moduleScript!.textContent).toBe('import { foo } from "./foo.js"')
  })

  test('application/json data script preserves content', async () => {
    const jsonData = JSON.stringify({ config: { theme: 'dark' } })

    const rootRoute = createRootRoute({
      scripts: () => [
        {
          type: 'application/json',
          children: jsonData,
        },
      ],
      component: () => {
        return (
          <div>
            <div data-testid="json-root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    await router.load()

    const { container } = await act(() =>
      render(<RouterProvider router={router} />),
    )

    const rootEl = container.querySelector('[data-testid="json-root"]')
    expect(rootEl).not.toBeNull()

    const scriptEl = container.querySelector('script[type="application/json"]')
    expect(scriptEl).not.toBeNull()
    expect(scriptEl!.innerHTML).toBe(jsonData)
  })

  test('data script does not duplicate into document.head', async () => {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Test Org',
    })

    const rootRoute = createRootRoute({
      scripts: () => [
        {
          type: 'application/ld+json',
          children: jsonLd,
        },
      ],
      component: () => {
        return (
          <div>
            <div data-testid="dup-root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    await router.load()

    const { container } = await act(() =>
      render(<RouterProvider router={router} />),
    )

    const rootEl = container.querySelector('[data-testid="dup-root"]')
    expect(rootEl).not.toBeNull()

    // Data scripts should NOT be duplicated into document.head by useEffect
    const headScripts = document.head.querySelectorAll(
      'script[type="application/ld+json"]',
    )
    expect(headScripts.length).toBe(0)

    // Should only exist once in the container
    const containerScripts = container.querySelectorAll(
      'script[type="application/ld+json"]',
    )
    expect(containerScripts.length).toBe(1)
    expect(containerScripts[0]!.innerHTML).toBe(jsonLd)
  })

  test('empty string type is treated as executable, injected via useEffect on client', async () => {
    const rootRoute = createRootRoute({
      scripts: () => [
        {
          type: '',
          children: 'console.log("empty type")',
        },
      ],
      component: () => {
        return (
          <div>
            <div data-testid="empty-type-root">root</div>
            <Outlet />
            <Scripts />
          </div>
        )
      },
    })

    const indexRoute = createRoute({
      path: '/',
      getParentRoute: () => rootRoute,
    })

    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    await router.load()

    const { container } = await act(() =>
      render(<RouterProvider router={router} />),
    )

    const rootEl = container.querySelector('[data-testid="empty-type-root"]')
    expect(rootEl).not.toBeNull()

    // Empty type = text/javascript per HTML spec. Executable scripts are
    // injected into document.head via useEffect on the client.
    const scriptEl = document.head.querySelector('script[type=""]')
    expect(scriptEl).not.toBeNull()
    expect(scriptEl!.textContent).toBe('console.log("empty type")')
  })
})
