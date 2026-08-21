import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import combinate from 'combinate'
import {
  Link,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useBlocker,
  useNavigate,
} from '../src'
import type { ShouldBlockFn } from '../src'

afterEach(() => {
  window.history.replaceState(null, 'root', '/')
  vi.resetAllMocks()
  cleanup()
})

interface BlockerTestOpts {
  blockerFn: ShouldBlockFn
  disabled?: boolean
  ignoreBlocker?: boolean
}

async function setup({ blockerFn, disabled, ignoreBlocker }: BlockerTestOpts) {
  const _mockBlockerFn = vi.fn(blockerFn)
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: function Setup() {
      const navigate = useNavigate()
      useBlocker({ disabled, shouldBlockFn: _mockBlockerFn })
      return (
        <>
          <h1>Index</h1>
          <Link to="/posts" ignoreBlocker={ignoreBlocker}>
            link to posts
          </Link>
          <Link to="/foo">link to foo</Link>
          <button onClick={() => navigate({ to: '/posts', ignoreBlocker })}>
            button
          </button>
        </>
      )
    },
  })

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts',
    component: () => (
      <>
        <h1>Posts</h1>
      </>
    ),
  })

  const fooRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/foo',
    beforeLoad: () => {
      throw redirect({ to: '/bar' })
    },
    component: () => (
      <>
        <h1>Foo</h1>
      </>
    ),
  })

  const barRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/bar',
    component: () => (
      <>
        <h1>Bar</h1>
      </>
    ),
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      postsRoute,
      fooRoute,
      barRoute,
    ]),
  })

  render(<RouterProvider router={router} />)
  expect(window.location.pathname).toBe('/')

  const postsLink = await screen.findByRole('link', { name: 'link to posts' })
  const fooLink = await screen.findByRole('link', { name: 'link to foo' })
  const button = await screen.findByRole('button', { name: 'button' })

  return {
    router,
    clickable: { postsLink, fooLink, button },
    blockerFn: _mockBlockerFn,
  }
}

const clickTarget = ['postsLink' as const, 'button' as const]

describe('Blocker', () => {
  const doesNotBlockTextMatrix = combinate({
    opts: [
      {
        blockerFn: () => false,
        disabled: false,
        ignoreBlocker: undefined,
      },
      {
        blockerFn: async () =>
          await new Promise<boolean>((resolve) => resolve(false)),
        disabled: false,
        ignoreBlocker: false,
      },
      {
        blockerFn: () => true,
        disabled: true,
        ignoreBlocker: false,
      },
      {
        blockerFn: () => true,
        disabled: false,
        ignoreBlocker: true,
      },
    ],
    clickTarget,
  })
  test.each(doesNotBlockTextMatrix)(
    'does not block navigation with blockerFn = $flags.blockerFn, ignoreBlocker = $flags.ignoreBlocker, clickTarget = $clickTarget',
    async ({ opts, clickTarget }) => {
      const { clickable, blockerFn } = await setup(opts)

      fireEvent.click(clickable[clickTarget])
      expect(
        await screen.findByRole('heading', { name: 'Posts' }),
      ).toBeInTheDocument()
      expect(window.location.pathname).toBe('/posts')
      if (opts.ignoreBlocker || opts.disabled)
        expect(blockerFn).not.toHaveBeenCalled()
    },
  )

  const blocksTextMatrix = combinate({
    opts: [
      {
        blockerFn: () => true,
        disabled: false,
        ignoreBlocker: undefined,
      },
      {
        blockerFn: async () =>
          await new Promise<boolean>((resolve) => resolve(true)),
        disabled: false,
        ignoreBlocker: false,
      },
    ],
    clickTarget,
  })
  test.each(blocksTextMatrix)(
    'blocks navigation with condition = $flags.blockerFn, ignoreBlocker = $flags.ignoreBlocker, clickTarget = $clickTarget',
    async ({ opts, clickTarget }) => {
      const { clickable } = await setup(opts)

      fireEvent.click(clickable[clickTarget])
      await expect(
        screen.findByRole('header', { name: 'Posts' }),
      ).rejects.toThrow()
      expect(window.location.pathname).toBe('/')
    },
  )

  test('blocker function is only called once when navigating to a route that redirects', async () => {
    const { clickable, blockerFn } = await setup({
      blockerFn: () => false,
      ignoreBlocker: false,
    })
    fireEvent.click(clickable.fooLink)
    expect(
      await screen.findByRole('heading', { name: 'Bar' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/bar')
    expect(blockerFn).toHaveBeenCalledTimes(1)
  })
})
