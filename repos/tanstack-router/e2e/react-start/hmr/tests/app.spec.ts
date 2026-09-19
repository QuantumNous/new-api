import { expect } from '@playwright/test'
import {
  createHmrFileEditor,
  replaceAll,
  test,
} from '@tanstack/router-e2e-utils'
import path from 'node:path'

import type { Page } from '@playwright/test'

const whitelistErrors = [
  'Failed to load resource: net::ERR_NAME_NOT_RESOLVED',
  'Failed to load resource: the server responded with a status of 504',
]

const hmrExpect = expect.configure({ timeout: 20_000 })
const isViteBundledDev = process.env.E2E_VITE_BUNDLED_DEV === 'true'

const routeFilePaths = {
  index: 'routes/index.tsx',
  root: 'routes/__root.tsx',
  child: 'routes/child.tsx',
  inputs: 'routes/inputs.tsx',
  componentHmrInlineSplit: 'routes/component-hmr-inline-split.tsx',
  componentHmrInlineNosplit: 'routes/component-hmr-inline-nosplit.tsx',
  componentHmrNamedSplit: 'routes/component-hmr-named-split.tsx',
  componentHmrNamedNosplit: 'routes/component-hmr-named-nosplit.tsx',
  componentHmrInlineErrorSplit: 'routes/component-hmr-inline-error-split.tsx',
  componentHmrNamedErrorSplit: 'routes/component-hmr-named-error-split.tsx',
  aliasedRouteImportParentPanel: 'components/AliasedRouteImportParentPanel.tsx',
  aliasedRouteImportChildPanel: 'components/AliasedRouteImportChildPanel.tsx',
  serverFnHmr: 'routes/server-fn-hmr.tsx',
  serverFnHmrFactory: 'hmr/server-fn-hmr-factory.ts',
} as const

type RouteFileKey = keyof typeof routeFilePaths

const routeFiles = Object.fromEntries(
  Object.entries(routeFilePaths).map(([key, relativePath]) => [
    key,
    path.join(process.cwd(), 'src', relativePath),
  ]),
) as Record<RouteFileKey, string>

const routeFileRestoreChecks: Partial<
  Record<
    RouteFileKey,
    {
      url: string
      testId: string
      text: string
      assert?: (page: Page) => Promise<void>
    }
  >
> = {
  index: {
    url: '/',
    testId: 'marker',
    text: 'baseline',
    assert: async (page) => {
      await expect(page.getByTestId('crumb-/')).toHaveCount(0, {
        timeout: 500,
      })
    },
  },
  root: {
    url: '/',
    testId: 'root-component-marker',
    text: 'root-component-baseline',
    assert: async (page) => {
      await expect(page.getByTestId('crumb-__root__')).toHaveText('Home', {
        timeout: 500,
      })
    },
  },
  child: {
    url: '/child',
    testId: 'child-greeting',
    text: 'Hello',
    assert: async (page) => {
      await expect(page.getByTestId('crumb-/child')).toHaveText('Child', {
        timeout: 500,
      })
    },
  },
  inputs: { url: '/inputs', testId: 'inputs-marker', text: 'inputs-baseline' },
  componentHmrInlineSplit: {
    url: '/component-hmr-inline-split',
    testId: 'component-hmr-marker',
    text: 'component-hmr-inline-split-baseline',
  },
  componentHmrInlineNosplit: {
    url: '/component-hmr-inline-nosplit',
    testId: 'component-hmr-marker',
    text: 'component-hmr-inline-nosplit-baseline',
  },
  componentHmrNamedSplit: {
    url: '/component-hmr-named-split',
    testId: 'component-hmr-marker',
    text: 'component-hmr-named-split-baseline',
  },
  componentHmrNamedNosplit: {
    url: '/component-hmr-named-nosplit',
    testId: 'component-hmr-marker',
    text: 'component-hmr-named-nosplit-baseline',
  },
  componentHmrInlineErrorSplit: {
    url: '/component-hmr-inline-error-split',
    testId: 'component-hmr-marker',
    text: 'component-hmr-inline-error-split-baseline',
  },
  componentHmrNamedErrorSplit: {
    url: '/component-hmr-named-error-split',
    testId: 'component-hmr-marker',
    text: 'component-hmr-named-error-split-baseline',
  },
  serverFnHmrFactory: {
    url: '/server-fn-hmr',
    testId: 'server-fn-hmr-marker',
    text: 'server-fn-hmr-baseline',
  },
}

function normalizeRouteSource(routeFileKey: RouteFileKey, source: string) {
  let next = source

  if (routeFileKey === 'index') {
    next = next.replace(
      "export const Route = createFileRoute('/')({\n  loader: () => ({\n    crumb: 'Index Added',\n  }),\n  component: Home,\n})",
      "export const Route = createFileRoute('/')({\n  component: Home,\n})",
    )
    next = replaceAll(next, 'updated', 'baseline')
  }

  if (routeFileKey === 'root') {
    for (const marker of [
      'root-component-inline-baseline',
      'root-component-inline-updated',
    ]) {
      next = next.replace(
        `  component: () => <RootDocument marker="${marker}"><RootContent /></RootDocument>,`,
        '  component: RootComponent,',
      )
    }

    for (const marker of [
      'root-shell-inline-baseline',
      'root-shell-inline-updated',
    ]) {
      next = next.replace(
        `  shellComponent: ({ children }) => <RootShellDocument marker="${marker}">{children}</RootShellDocument>,\n  component: RootContent,`,
        '  component: RootComponent,',
      )
    }

    next = next.replace(
      '  shellComponent: RootShell,\n  component: RootContent,',
      '  component: RootComponent,',
    )

    for (const marker of ['root-shell-baseline', 'root-shell-updated']) {
      next = next.replace(
        `function RootShell({ children }: { children: ReactNode }) {\n  return <RootShellDocument marker="${marker}">{children}</RootShellDocument>\n}\n\nfunction Breadcrumbs() {`,
        'function Breadcrumbs() {',
      )
    }

    next = replaceAll(next, "crumb: 'Home Updated'", "crumb: 'Home'")
    next = replaceAll(next, 'root-component-updated', 'root-component-baseline')
    next = replaceAll(next, 'root-shell-updated', 'root-shell-baseline')
  }

  if (routeFileKey === 'child') {
    const beforeLoadBlock =
      "  beforeLoad: () => ({\n    greeting: 'Hello',\n  }),\n"
    const loaderBlock = "  loader: () => ({\n    crumb: 'Child',\n  }),\n"

    next = replaceAll(next, "greeting: 'Hi'", "greeting: 'Hello'")
    next = replaceAll(next, "crumb: 'Child Updated Again'", "crumb: 'Child'")
    next = replaceAll(next, "crumb: 'Child Updated'", "crumb: 'Child'")

    if (!next.includes(beforeLoadBlock)) {
      next = next.replace(
        '  component: Child,\n',
        `${beforeLoadBlock}  component: Child,\n`,
      )
    }
    if (!next.includes(loaderBlock)) {
      const withLoaderAfterBeforeLoad = next.replace(
        `${beforeLoadBlock}  component: Child,\n`,
        `${beforeLoadBlock}${loaderBlock}  component: Child,\n`,
      )
      next =
        withLoaderAfterBeforeLoad === next
          ? next.replace(
              '  component: Child,\n',
              `${loaderBlock}  component: Child,\n`,
            )
          : withLoaderAfterBeforeLoad
    }
  }

  const markerReplacements: Partial<Record<RouteFileKey, [string, string]>> = {
    inputs: ['inputs-updated', 'inputs-baseline'],
    componentHmrInlineSplit: [
      'component-hmr-inline-split-updated',
      'component-hmr-inline-split-baseline',
    ],
    componentHmrInlineNosplit: [
      'component-hmr-inline-nosplit-updated',
      'component-hmr-inline-nosplit-baseline',
    ],
    componentHmrNamedSplit: [
      'component-hmr-named-split-updated',
      'component-hmr-named-split-baseline',
    ],
    componentHmrNamedNosplit: [
      'component-hmr-named-nosplit-updated',
      'component-hmr-named-nosplit-baseline',
    ],
    componentHmrInlineErrorSplit: [
      'component-hmr-inline-error-split-updated',
      'component-hmr-inline-error-split-baseline',
    ],
    componentHmrNamedErrorSplit: [
      'component-hmr-named-error-split-updated',
      'component-hmr-named-error-split-baseline',
    ],
    aliasedRouteImportParentPanel: [
      'aliased-parent-updated',
      'aliased-parent-baseline',
    ],
    aliasedRouteImportChildPanel: [
      'aliased-child-updated',
      'aliased-child-baseline',
    ],
  }
  const markerReplacement = markerReplacements[routeFileKey]
  if (markerReplacement) {
    next = replaceAll(next, markerReplacement[0], markerReplacement[1])
  }

  if (routeFileKey === 'serverFnHmrFactory') {
    next = next.replace(
      /^import \{ .* \} from '@tanstack\/react-start'$/m,
      "import { createClientOnlyFn, createServerOnlyFn } from '@tanstack/react-start'",
    )
    next = replaceAll(
      next,
      'export const createServerFnHmrFactory = createClientOnlyFn',
      'export const createServerFnHmrFactory = createServerOnlyFn',
    )
    next = replaceAll(
      next,
      'server-fn-hmr-client-only',
      'server-fn-hmr-baseline',
    )
  }

  return next
}

const routeFileEditor = createHmrFileEditor({
  files: routeFiles,
  normalizeSource: normalizeRouteSource,
})
const capturePromise = routeFileEditor.capturePromise
const routeKeysPendingRestoreCheck = routeFileEditor.pendingRestoreKeys
const restoreRouteFiles = routeFileEditor.restoreFiles
const replaceRouteText = routeFileEditor.replaceText

async function replaceRouteTextAndWait(
  page: Page,
  routeFileKey: RouteFileKey,
  from: string,
  to: string,
  assertion: () => Promise<void>,
) {
  if (isViteBundledDev) {
    // Rolldown may still be compiling a lazy route entry immediately after
    // hydration. Avoid writing a follow-up edit while that compile is settling.
    await page.waitForTimeout(500)
  }
  await routeFileEditor.replaceText(routeFileKey, from, to)
  await assertion()
}

async function rewriteRouteFile(
  page: Page,
  routeFileKey: RouteFileKey,
  updater: (source: string) => string,
  assertion: () => Promise<void>,
  options: { allowNoop?: boolean } = {},
) {
  if (isViteBundledDev) {
    await page.waitForTimeout(500)
  }
  await routeFileEditor.rewriteFile(routeFileKey, updater, options)
  await assertion()
}

/**
 * Waits for the router to observe the latest route module after an edit.
 * This avoids bundler-specific HMR console message matching.
 */
async function waitForRouteModuleUpdate(
  page: Page,
  routeId: string,
  expectedCrumb: string,
) {
  await page.waitForFunction(
    ([nextRouteId, nextCrumb]) => {
      const router = (window as any).__TSR_ROUTER__
      const route = router?.routesById?.[nextRouteId]
      if (!route) {
        return false
      }

      const loader = route.options?.loader
      if (typeof loader !== 'function') {
        return false
      }

      const loaderResult = loader()
      return loaderResult?.crumb === nextCrumb
    },
    [routeId, expectedCrumb],
    { timeout: 20_000 },
  )
}

async function waitForRouteRemovalReload(page: Page) {
  await page.waitForFunction(() => {
    const router = (window as any).__TSR_ROUTER__
    const match = router?.stores?.matches
      ?.get()
      ?.find((entry: any) => entry.routeId === '/child')

    return !match?.invalid && match?.isFetching === false
  })
}

async function waitForServerRenderedText(
  page: Page,
  url: string,
  text: string,
) {
  const deadline = Date.now() + 60_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const response = await page.request.get(url)
      const body = await response.text()

      if (response.ok() && body.includes(text)) {
        return
      }

      lastError = new Error(
        `Expected server HTML for ${url} to include ${JSON.stringify(text)}`,
      )
    } catch (error) {
      lastError = error
    }

    await page.waitForTimeout(100)
  }

  throw lastError
}

async function waitForHydrationSafeReload(
  page: Page,
  url: string,
  text: string,
) {
  await waitForServerRenderedText(page, url, text)
  // The client and SSR compilers can finish in different ticks. Give the
  // browser-side module graph a quiet window after SSR has the expected HTML.
  await page.waitForTimeout(750)
}

async function reloadPageAndWait(page: Page, url: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      break
    } catch (error) {
      if (attempt === 3 || !String(error).includes('net::ERR_ABORTED')) {
        throw error
      }
      await page.waitForTimeout(250)
    }
  }
  await page.getByTestId('hydrated').waitFor({ state: 'visible' })
}

async function reloadPageAndWaitForText(
  page: Page,
  url: string,
  testId: string,
  text: string,
) {
  const deadline = Date.now() + 60_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      await waitForHydrationSafeReload(page, url, text)
      await reloadPageAndWait(page, url)
      await expect(page.getByTestId(testId)).toHaveText(text, {
        timeout: 1_000,
      })
      return
    } catch (error) {
      lastError = error
      await page.waitForTimeout(150)
    }
  }

  throw lastError
}

async function waitForServerFnHmrReady(page: Page) {
  await page.getByTestId('hydrated').waitFor({ state: 'visible' })
  await expect(page.getByTestId('invoke-server-fn-hmr')).toBeVisible()
}

async function waitForServerFnHmrMarker(page: Page, text: string) {
  await waitForServerFnHmrReady(page)
  await hmrExpect(page.getByTestId('server-fn-hmr-marker')).toHaveText(text)
  await hmrExpect(page.getByTestId('server-fn-hmr-result')).toBeVisible()
}

async function waitForRestoredRouteFile(
  page: Page,
  routeFileKey: RouteFileKey,
) {
  const restoreCheck = routeFileRestoreChecks[routeFileKey]

  if (!restoreCheck) {
    return
  }

  // Restores happen immediately after a previous edit, so poll until the dev
  // server has actually observed the restored file before the next test starts.
  const deadline = Date.now() + 20_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      await waitForHydrationSafeReload(
        page,
        restoreCheck.url,
        restoreCheck.text,
      )
      await reloadPageAndWait(page, restoreCheck.url)
      await expect(page.getByTestId(restoreCheck.testId)).toHaveText(
        restoreCheck.text,
        { timeout: 500 },
      )
      await restoreCheck.assert?.(page)
      await page.waitForTimeout(100)
      await expect(page.getByTestId(restoreCheck.testId)).toHaveText(
        restoreCheck.text,
        { timeout: 1_000 },
      )
      await restoreCheck.assert?.(page)
      return
    } catch (error) {
      lastError = error
      await page.waitForTimeout(100)
    }
  }

  throw lastError
}

async function seedHomeState(page: Page) {
  await page.goto('/')
  await page.getByTestId('hydrated').waitFor({ state: 'visible' })
  await page.getByTestId('increment').click()
  await page.getByTestId('message').fill('index preserved')
  await page.getByTestId('root-message').fill('root preserved')
}

async function expectHomeStatePreserved(page: Page) {
  await expect(page.getByTestId('count')).toHaveText('Count: 1')
  await expect(page.getByTestId('message')).toHaveValue('index preserved')
  await expect(page.getByTestId('root-message')).toHaveValue('root preserved')
}

async function seedComponentHmrState(page: Page, url: string) {
  await page.goto(url)
  await page.getByTestId('hydrated').waitFor({ state: 'visible' })
  await page.getByTestId('component-hmr-increment').click()
  await page.getByTestId('component-hmr-message').fill('component preserved')
  await page.getByTestId('root-message').fill('root preserved')
}

async function expectComponentHmrStatePreserved(page: Page) {
  await expect(page.getByTestId('component-hmr-count')).toHaveText('Count: 1')
  await expect(page.getByTestId('component-hmr-message')).toHaveValue(
    'component preserved',
  )
  await expect(page.getByTestId('root-message')).toHaveValue('root preserved')
}

test.describe('react-start hmr', () => {
  test.use({ whitelistErrors })

  test.beforeEach(async ({ page }) => {
    await capturePromise
    const pendingRouteKeys = Array.from(routeKeysPendingRestoreCheck)
    const restoredRouteKeys = await restoreRouteFiles(pendingRouteKeys)
    for (const routeFileKey of restoredRouteKeys) {
      routeKeysPendingRestoreCheck.add(routeFileKey)
    }

    const routeKeysToCheck = Array.from(routeKeysPendingRestoreCheck)
    routeKeysPendingRestoreCheck.clear()

    for (const routeFileKey of routeKeysToCheck) {
      await waitForRestoredRouteFile(page, routeFileKey)
    }
  })

  test.afterEach(async () => {
    await capturePromise
    const restoredRouteKeys = await restoreRouteFiles()
    for (const routeFileKey of restoredRouteKeys) {
      routeKeysPendingRestoreCheck.add(routeFileKey)
    }
  })

  test.afterAll(async () => {
    await capturePromise
    await restoreRouteFiles()
  })

  test('preserves local state for code-split route component HMR', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })

    await page.getByTestId('increment').click()
    await page.getByTestId('message').fill('hmr state')

    await expect(page.getByTestId('count')).toHaveText('Count: 1')
    await expect(page.getByTestId('marker')).toHaveText('baseline')

    await replaceRouteTextAndWait(
      page,
      'index',
      'baseline',
      'updated',
      async () => {
        await hmrExpect(page.getByTestId('marker')).toHaveText('updated')
      },
    )

    await expect(page.getByTestId('count')).toHaveText('Count: 1')
    await expect(page.getByTestId('message')).toHaveValue('hmr state')
  })

  test('updates breadcrumb data when non-component route options change', async ({
    page,
  }) => {
    await page.goto('/child')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })

    await expect(page.getByTestId('child')).toHaveText('child')
    await expect(page.getByTestId('crumb-__root__')).toHaveText('Home')
    await expect(page.getByTestId('crumb-/child')).toHaveText('Child')

    await replaceRouteTextAndWait(
      page,
      'root',
      "crumb: 'Home'",
      "crumb: 'Home Updated'",
      async () => {
        await waitForRouteModuleUpdate(page, '__root__', 'Home Updated')
        await hmrExpect(page.getByTestId('crumb-__root__')).toHaveText(
          'Home Updated',
        )
      },
    )

    await expect(page.getByTestId('crumb-/child')).toHaveText('Child')
  })

  test('updates child route loader data without rebuilding the route tree', async ({
    page,
  }) => {
    await page.goto('/child')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })
    await page.getByTestId('root-message').fill('child preserved')

    await expect(page.getByTestId('crumb-/child')).toHaveText('Child')

    await replaceRouteTextAndWait(
      page,
      'child',
      "crumb: 'Child'",
      "crumb: 'Child Updated'",
      async () => {
        await waitForRouteModuleUpdate(page, '/child', 'Child Updated')
        await hmrExpect(page.getByTestId('crumb-/child')).toHaveText(
          'Child Updated',
        )
      },
    )

    await expect(page.getByTestId('root-message')).toHaveValue(
      'child preserved',
    )
    await expect(page.getByTestId('child')).toHaveText('child')
  })

  test('adds a createFileRoute property during HMR', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })
    await page.getByTestId('root-message').fill('property added')
    await page.getByTestId('message').fill('index preserved')

    await expect(page.getByTestId('crumb-/')).toHaveCount(0)

    await rewriteRouteFile(
      page,
      'index',
      (source) =>
        source.replace(
          "export const Route = createFileRoute('/')({\n  component: Home,\n})",
          "export const Route = createFileRoute('/')({\n  loader: () => ({\n    crumb: 'Index Added',\n  }),\n  component: Home,\n})",
        ),
      async () => {
        await waitForRouteModuleUpdate(page, '/', 'Index Added')
        await hmrExpect(page.getByTestId('crumb-/')).toHaveText('Index Added')
      },
    )

    await expect(page.getByTestId('root-message')).toHaveValue('property added')
    await expect(page.getByTestId('message')).toHaveValue('index preserved')
  })

  test('removes a createFileRoute property during HMR', async ({ page }) => {
    await page.goto('/child')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })
    await page.getByTestId('root-message').fill('property removed')

    await expect(page.getByTestId('crumb-/child')).toHaveText('Child')

    await rewriteRouteFile(
      page,
      'child',
      (source) =>
        source.replace("  loader: () => ({\n    crumb: 'Child',\n  }),\n", ''),
      async () => {
        await waitForRouteRemovalReload(page)
        await hmrExpect(page.getByTestId('crumb-/child')).toHaveCount(0)
      },
    )

    await expect(page.getByTestId('root-message')).toHaveValue(
      'property removed',
    )
    await expect(page.getByTestId('child')).toHaveText('child')
  })

  test('picks up latest child loader when navigating after multiple HMR saves', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })

    // First edit: change child loader while on /
    await replaceRouteTextAndWait(
      page,
      'child',
      "crumb: 'Child'",
      "crumb: 'Child Updated'",
      async () => {
        await waitForRouteModuleUpdate(page, '/child', 'Child Updated')
      },
    )

    // Second edit: change child loader again while still on /
    await replaceRouteTextAndWait(
      page,
      'child',
      "crumb: 'Child Updated'",
      "crumb: 'Child Updated Again'",
      async () => {
        await waitForRouteModuleUpdate(page, '/child', 'Child Updated Again')
      },
    )
    await waitForHydrationSafeReload(page, '/child', 'Child Updated Again')

    // Now navigate to /child — should see the LATEST value
    await page.getByTestId('child-link').click()
    await expect(page.getByTestId('child')).toBeVisible()

    await hmrExpect(page.getByTestId('crumb-/child')).toHaveText(
      'Child Updated Again',
    )
  })

  test('root route loader HMR preserves index route local state', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })

    // Set up local state in the index route
    await page.getByTestId('increment').click()
    await page.getByTestId('increment').click()
    await page.getByTestId('message').fill('preserve me')

    await expect(page.getByTestId('count')).toHaveText('Count: 2')
    await expect(page.getByTestId('crumb-__root__')).toHaveText('Home')

    // Change the root route's loader — should NOT reset index state
    await replaceRouteTextAndWait(
      page,
      'root',
      "crumb: 'Home'",
      "crumb: 'Home Updated'",
      async () => {
        await waitForRouteModuleUpdate(page, '__root__', 'Home Updated')
        await hmrExpect(page.getByTestId('crumb-__root__')).toHaveText(
          'Home Updated',
        )
      },
    )

    await expect(page.getByTestId('count')).toHaveText('Count: 2')
    await expect(page.getByTestId('message')).toHaveValue('preserve me')
  })

  test('preserves uncontrolled input state during HMR', async ({ page }) => {
    await reloadPageAndWaitForText(
      page,
      '/inputs',
      'inputs-marker',
      'inputs-baseline',
    )

    // Type into both uncontrolled inputs
    await page.getByTestId('input-first').fill('first value')
    await page.getByTestId('input-second').fill('second value')

    await expect(page.getByTestId('inputs-marker')).toHaveText(
      'inputs-baseline',
    )

    // Trigger HMR by changing the marker text
    await replaceRouteTextAndWait(
      page,
      'inputs',
      'inputs-baseline',
      'inputs-updated',
      async () => {
        await hmrExpect(page.getByTestId('inputs-marker')).toHaveText(
          'inputs-updated',
        )
      },
    )

    // Both inputs should still have their typed values
    await expect(page.getByTestId('input-first')).toHaveValue('first value')
    await expect(page.getByTestId('input-second')).toHaveValue('second value')
  })

  test('updates beforeLoad context value during HMR', async ({ page }) => {
    await page.goto('/child')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })
    await page.getByTestId('root-message').fill('beforeLoad test')

    await expect(page.getByTestId('child-greeting')).toHaveText('Hello')

    // Change the beforeLoad return value
    await replaceRouteTextAndWait(
      page,
      'child',
      "greeting: 'Hello'",
      "greeting: 'Hi'",
      async () => {
        await hmrExpect(page.getByTestId('child-greeting')).toHaveText('Hi')
      },
    )

    // Root state should be preserved
    await expect(page.getByTestId('root-message')).toHaveValue(
      'beforeLoad test',
    )
    await expect(page.getByTestId('child')).toHaveText('child')
  })

  test('keeps aliased route import links working after component HMR', async ({
    page,
  }) => {
    await page.goto('/aliased-route-imports/A')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })

    await expect(page.getByTestId('aliased-parent-marker')).toHaveText(
      'aliased-parent-baseline',
    )
    await expect(page.getByTestId('aliased-show-child')).toHaveAttribute(
      'href',
      '/aliased-route-imports/A/child',
    )

    await replaceRouteTextAndWait(
      page,
      'aliasedRouteImportParentPanel',
      'aliased-parent-baseline',
      'aliased-parent-updated',
      async () => {
        await hmrExpect(page.getByTestId('aliased-parent-marker')).toHaveText(
          'aliased-parent-updated',
        )
      },
    )

    await expect(page.getByTestId('aliased-show-child')).toHaveAttribute(
      'href',
      '/aliased-route-imports/A/child',
    )
    await page.getByTestId('aliased-show-child').click()
    await expect(page).toHaveURL(/\/aliased-route-imports\/A\/child$/)

    await page.goto('/aliased-route-imports/A/child')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })
    await expect(page.getByTestId('aliased-child-marker')).toHaveText(
      'aliased-child-baseline',
    )
    await expect(page.getByTestId('aliased-back-parent')).toHaveAttribute(
      'href',
      '/aliased-route-imports/A',
    )

    await replaceRouteTextAndWait(
      page,
      'aliasedRouteImportChildPanel',
      'aliased-child-baseline',
      'aliased-child-updated',
      async () => {
        await hmrExpect(page.getByTestId('aliased-child-marker')).toHaveText(
          'aliased-child-updated',
        )
      },
    )

    await expect(page.getByTestId('aliased-back-parent')).toHaveAttribute(
      'href',
      '/aliased-route-imports/A',
    )
    await page.getByTestId('aliased-back-parent').click()
    await expect(page).toHaveURL(/\/aliased-route-imports\/A$/)
  })

  test('clears stale beforeLoad context when beforeLoad is removed', async ({
    page,
  }) => {
    await page.goto('/child')
    await page.getByTestId('hydrated').waitFor({ state: 'visible' })
    await page.getByTestId('root-message').fill('beforeLoad removal')

    await expect(page.getByTestId('child-greeting')).toHaveText('Hello')

    // Remove beforeLoad entirely
    await rewriteRouteFile(
      page,
      'child',
      (source) =>
        source.replace(
          "  beforeLoad: () => ({\n    greeting: 'Hello',\n  }),\n",
          '',
        ),
      async () => {
        await waitForRouteRemovalReload(page)
        await hmrExpect(page.getByTestId('child-greeting')).toHaveCount(0)
      },
      { allowNoop: true },
    )

    // Root state should be preserved
    await expect(page.getByTestId('root-message')).toHaveValue(
      'beforeLoad removal',
    )
    await expect(page.getByTestId('child')).toHaveText('child')
    // Loader crumb should still work
    await expect(page.getByTestId('crumb-/child')).toHaveText('Child')
  })

  test('updates root route component during HMR when component is defined inline', async ({
    page,
  }) => {
    await rewriteRouteFile(
      page,
      'root',
      (source) =>
        source.replace(
          '  component: RootComponent,',
          '  component: () => <RootDocument marker="root-component-inline-baseline"><RootContent /></RootDocument>,',
        ),
      async () => {},
    )
    await page.waitForTimeout(300)

    await reloadPageAndWaitForText(
      page,
      '/',
      'root-component-marker',
      'root-component-inline-baseline',
    )
    await page.getByTestId('increment').click()
    await page.getByTestId('message').fill('index preserved')
    await page.getByTestId('root-message').fill('root preserved')

    await replaceRouteTextAndWait(
      page,
      'root',
      'root-component-inline-baseline',
      'root-component-inline-updated',
      async () => {
        await hmrExpect(page.getByTestId('root-component-marker')).toHaveText(
          'root-component-inline-updated',
        )
      },
    )
  })

  test('updates root route component during HMR when component is not defined inline', async ({
    page,
  }) => {
    await seedHomeState(page)

    await replaceRouteTextAndWait(
      page,
      'root',
      'root-component-baseline',
      'root-component-updated',
      async () => {
        await hmrExpect(page.getByTestId('root-component-marker')).toHaveText(
          'root-component-updated',
        )
      },
    )
  })

  test('updates root route shellComponent during HMR when shellComponent is defined inline', async ({
    page,
  }) => {
    await rewriteRouteFile(
      page,
      'root',
      (source) =>
        source.replace(
          '  component: RootComponent,',
          '  shellComponent: ({ children }) => <RootShellDocument marker="root-shell-inline-baseline">{children}</RootShellDocument>,\n  component: RootContent,',
        ),
      async () => {},
    )
    await page.waitForTimeout(300)

    await reloadPageAndWaitForText(
      page,
      '/',
      'root-shell-marker',
      'root-shell-inline-baseline',
    )
    await page.getByTestId('increment').click()
    await page.getByTestId('message').fill('index preserved')
    await page.getByTestId('root-message').fill('root preserved')

    await replaceRouteTextAndWait(
      page,
      'root',
      'root-shell-inline-baseline',
      'root-shell-inline-updated',
      async () => {
        await hmrExpect(page.getByTestId('root-shell-marker')).toHaveText(
          'root-shell-inline-updated',
        )
      },
    )
  })

  test('updates root route shellComponent during HMR when shellComponent is not defined inline', async ({
    page,
  }) => {
    await rewriteRouteFile(
      page,
      'root',
      (source) =>
        source
          .replace(
            '  component: RootComponent,',
            '  shellComponent: RootShell,\n  component: RootContent,',
          )
          .replace(
            'function Breadcrumbs() {',
            'function RootShell({ children }: { children: ReactNode }) {\n  return <RootShellDocument marker="root-shell-baseline">{children}</RootShellDocument>\n}\n\nfunction Breadcrumbs() {',
          ),
      async () => {},
    )
    await page.waitForTimeout(300)

    await reloadPageAndWaitForText(
      page,
      '/',
      'root-shell-marker',
      'root-shell-baseline',
    )
    await page.getByTestId('increment').click()
    await page.getByTestId('message').fill('index preserved')
    await page.getByTestId('root-message').fill('root preserved')

    await replaceRouteTextAndWait(
      page,
      'root',
      'root-shell-baseline',
      'root-shell-updated',
      async () => {
        await hmrExpect(page.getByTestId('root-shell-marker')).toHaveText(
          'root-shell-updated',
        )
      },
    )
  })

  test('updates non-root route component during HMR when component is defined inline and codeSplitGroupings is undefined', async ({
    page,
  }) => {
    await seedComponentHmrState(page, '/component-hmr-inline-split')

    await replaceRouteTextAndWait(
      page,
      'componentHmrInlineSplit',
      'component-hmr-inline-split-baseline',
      'component-hmr-inline-split-updated',
      async () => {
        await hmrExpect(page.getByTestId('component-hmr-marker')).toHaveText(
          'component-hmr-inline-split-updated',
        )
      },
    )

    await expectComponentHmrStatePreserved(page)
  })

  test('updates non-root route component during HMR when component is defined inline and codeSplitGroupings disables code splitting', async ({
    page,
  }) => {
    await seedComponentHmrState(page, '/component-hmr-inline-nosplit')

    await replaceRouteTextAndWait(
      page,
      'componentHmrInlineNosplit',
      'component-hmr-inline-nosplit-baseline',
      'component-hmr-inline-nosplit-updated',
      async () => {
        await hmrExpect(page.getByTestId('component-hmr-marker')).toHaveText(
          'component-hmr-inline-nosplit-updated',
        )
      },
    )

    await expectComponentHmrStatePreserved(page)
  })

  test('updates non-root route component during HMR when component is not defined inline and codeSplitGroupings is undefined', async ({
    page,
  }) => {
    await seedComponentHmrState(page, '/component-hmr-named-split')

    await replaceRouteTextAndWait(
      page,
      'componentHmrNamedSplit',
      'component-hmr-named-split-baseline',
      'component-hmr-named-split-updated',
      async () => {
        await hmrExpect(page.getByTestId('component-hmr-marker')).toHaveText(
          'component-hmr-named-split-updated',
        )
      },
    )

    await expectComponentHmrStatePreserved(page)
  })

  test('updates non-root route component during HMR when component is not defined inline and codeSplitGroupings disables code splitting', async ({
    page,
  }) => {
    await seedComponentHmrState(page, '/component-hmr-named-nosplit')

    await replaceRouteTextAndWait(
      page,
      'componentHmrNamedNosplit',
      'component-hmr-named-nosplit-baseline',
      'component-hmr-named-nosplit-updated',
      async () => {
        await hmrExpect(page.getByTestId('component-hmr-marker')).toHaveText(
          'component-hmr-named-nosplit-updated',
        )
      },
    )

    await expectComponentHmrStatePreserved(page)
  })

  test('updates non-root route component during HMR when component is defined inline and only errorComponent is split', async ({
    page,
  }) => {
    await seedComponentHmrState(page, '/component-hmr-inline-error-split')

    await replaceRouteTextAndWait(
      page,
      'componentHmrInlineErrorSplit',
      'component-hmr-inline-error-split-baseline',
      'component-hmr-inline-error-split-updated',
      async () => {
        await hmrExpect(page.getByTestId('component-hmr-marker')).toHaveText(
          'component-hmr-inline-error-split-updated',
        )
      },
    )

    await expectComponentHmrStatePreserved(page)
  })

  test('updates non-root route component during HMR when component is not defined inline and only errorComponent is split', async ({
    page,
  }) => {
    await seedComponentHmrState(page, '/component-hmr-named-error-split')

    await replaceRouteTextAndWait(
      page,
      'componentHmrNamedErrorSplit',
      'component-hmr-named-error-split-baseline',
      'component-hmr-named-error-split-updated',
      async () => {
        await hmrExpect(page.getByTestId('component-hmr-marker')).toHaveText(
          'component-hmr-named-error-split-updated',
        )
      },
    )

    await expectComponentHmrStatePreserved(page)
  })

  test('invalidates transitive server function compiler state during HMR', async ({
    page,
  }) => {
    await page.goto('/server-fn-hmr')
    await waitForServerFnHmrMarker(page, 'server-fn-hmr-baseline')
    await page.getByTestId('invoke-server-fn-hmr').click()
    await expect(page.getByTestId('server-fn-hmr-result')).toHaveText(
      'server-fn-hmr-baseline-result',
    )
    await expect(page.getByTestId('server-fn-hmr-error')).toHaveText('none')

    await replaceRouteText(
      'serverFnHmrFactory',
      "createServerOnlyFn\nexport const serverFnHmrMarker = 'server-fn-hmr-baseline'",
      "createClientOnlyFn\nexport const serverFnHmrMarker = 'server-fn-hmr-client-only'",
    )

    await reloadPageAndWaitForText(
      page,
      '/server-fn-hmr',
      'server-fn-hmr-marker',
      'server-fn-hmr-client-only',
    )

    await page.getByTestId('invoke-server-fn-hmr').click()
    await expect(page.getByTestId('server-fn-hmr-result')).toHaveText('idle')
    await expect(page.getByTestId('server-fn-hmr-error')).toContainText(
      'createClientOnlyFn() functions can only be called on the client!',
    )

    await replaceRouteText(
      'serverFnHmrFactory',
      "createClientOnlyFn\nexport const serverFnHmrMarker = 'server-fn-hmr-client-only'",
      "createServerOnlyFn\nexport const serverFnHmrMarker = 'server-fn-hmr-baseline'",
    )
    await reloadPageAndWaitForText(
      page,
      '/server-fn-hmr',
      'server-fn-hmr-marker',
      'server-fn-hmr-baseline',
    )

    await page.getByTestId('invoke-server-fn-hmr').click()
    await expect(page.getByTestId('server-fn-hmr-result')).toHaveText(
      'server-fn-hmr-baseline-result',
    )
    await expect(page.getByTestId('server-fn-hmr-error')).toHaveText('none')
  })
})
