import { createMemoryHistory } from '@tanstack/history'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { getScrollRestorationScriptForRouter } from '../src/scroll-restoration-script/server'
import { BaseRootRoute, BaseRoute, storageKey } from '../src'
import { createTestRouter } from './routerTestUtils'

function createScrollRestorationRouter(getScrollRestorationKey?: () => string) {
  const rootRoute = new BaseRootRoute({})
  const indexRoute = new BaseRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  return createTestRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    isServer: true,
    scrollRestoration: true,
    getScrollRestorationKey,
  })
}

function runScrollRestorationScript(script: string | null) {
  expect(script).toBeTruthy()
  new Function(script!)()
}

afterEach(() => {
  window.sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('getScrollRestorationScriptForRouter', () => {
  test('restores SSR scroll entries for a user supplied key', () => {
    const router = createScrollRestorationRouter(() => 'custom-key')
    const script = getScrollRestorationScriptForRouter(router)
    const scrollTo = vi.fn()

    window.history.replaceState({ __TSR_key: 'history-key' }, '', '/')
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        'custom-key': {
          window: { scrollX: 11, scrollY: 22 },
        },
        'history-key': {
          window: { scrollX: 33, scrollY: 44 },
        },
      }),
    )

    vi.stubGlobal('scrollTo', scrollTo)

    runScrollRestorationScript(script)

    expect(scrollTo).toHaveBeenCalledWith(11, 22)
  })

  test('restores SSR scroll entries for the default history key', () => {
    const router = createScrollRestorationRouter()
    const script = getScrollRestorationScriptForRouter(router)
    const scrollTo = vi.fn()

    window.history.replaceState({ __TSR_key: 'history-key' }, '', '/')
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        'history-key': {
          window: { scrollX: 33, scrollY: 44 },
        },
        '/': {
          window: { scrollX: 11, scrollY: 22 },
        },
      }),
    )

    vi.stubGlobal('scrollTo', scrollTo)

    runScrollRestorationScript(script)

    expect(scrollTo).toHaveBeenCalledWith(33, 44)
  })

  test('ignores invalid serialized scroll storage', () => {
    const router = createScrollRestorationRouter()
    const script = getScrollRestorationScriptForRouter(router)
    const scrollTo = vi.fn()

    window.history.replaceState({ __TSR_key: 'history-key' }, '', '/')
    window.sessionStorage.setItem(storageKey, '{')
    vi.stubGlobal('scrollTo', scrollTo)

    expect(() => runScrollRestorationScript(script)).not.toThrow()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  test('ignores malformed scroll entries and falls back to top', () => {
    const router = createScrollRestorationRouter()
    const script = getScrollRestorationScriptForRouter(router)
    const scrollTo = vi.fn()

    window.history.replaceState({ __TSR_key: 'history-key' }, '', '/')
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        'history-key': {
          window: { scrollX: 'bad', scrollY: 44 },
          '[': { scrollX: 11, scrollY: 22 },
          empty: null,
        },
      }),
    )
    vi.stubGlobal('scrollTo', scrollTo)

    expect(() => runScrollRestorationScript(script)).not.toThrow()
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  test('ignores a malformed restoration key payload and falls back to top', () => {
    const router = createScrollRestorationRouter()
    const script = getScrollRestorationScriptForRouter(router)
    const scrollTo = vi.fn()

    window.history.replaceState({ __TSR_key: 'history-key' }, '', '/')
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        'history-key': 'not an entry object',
      }),
    )
    vi.stubGlobal('scrollTo', scrollTo)

    expect(() => runScrollRestorationScript(script)).not.toThrow()
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  test('falls back safely when restoration key is missing from storage', () => {
    const router = createScrollRestorationRouter()
    const script = getScrollRestorationScriptForRouter(router)
    const scrollTo = vi.fn()

    window.history.replaceState({ __TSR_key: 'history-key' }, '', '/')
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        'other-key': { window: { scrollX: 1, scrollY: 2 } },
      }),
    )
    vi.stubGlobal('scrollTo', scrollTo)

    expect(() => runScrollRestorationScript(script)).not.toThrow()
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })
})
