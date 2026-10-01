import * as fs from 'node:fs'
import { expect } from '@playwright/test'
import { getTestServerPort, test } from '@tanstack/router-e2e-utils'
import packageJson from '../package.json' with { type: 'json' }
import type { Page } from '@playwright/test'

const e2ePortKey = process.env.E2E_PORT_KEY ?? packageJson.name
const PORT = await getTestServerPort(e2ePortKey)

test('Server function URLs correctly include explicit ids', async ({
  page,
}) => {
  const expectedIds: Record<string, string> = {
    '/submit-post-formdata': 'submit-post-formdata-greetUser',
    '/formdata-redirect': 'formdata-redirect-greetUser',
  }

  for (const [currentPage, expectedId] of Object.entries(expectedIds)) {
    await page.goto(currentPage)
    await page.waitForLoadState('networkidle')

    const form = page.locator('form')
    const actionUrl = await form.getAttribute('action')

    expect(actionUrl).toMatch(`/_serverFn/${expectedId}`)
  }
})

test('invoking a server function with custom response status code', async ({
  page,
}) => {
  await page.goto('/status')

  await page.waitForLoadState('networkidle')

  const requestPromise = new Promise<void>((resolve) => {
    page.on('response', (response) => {
      expect(response.status()).toBe(225)
      expect(response.statusText()).toBe('hello')
      expect(response.headers()['content-type']).toContain('application/json')
      resolve()
    })
  })
  await page.getByTestId('invoke-server-fn').click()
  await requestPromise
})

test('Consistent server function returns both on client and server for GET and POST calls', async ({
  page,
}) => {
  await page.goto('/consistent')

  await page.waitForLoadState('networkidle')
  const expected =
    (await page
      .getByTestId('expected-consistent-server-fns-result')
      .textContent()) || ''
  expect(expected).not.toBe('')

  await expect(page.getByTestId('consistent-client-hydrated')).toBeAttached()

  await page.getByTestId('test-consistent-server-fn-calls-btn').click()
  await page.waitForLoadState('networkidle')

  // GET calls
  await expect(page.getByTestId('cons_serverGetFn1-response')).toContainText(
    expected,
  )
  await expect(page.getByTestId('cons_getFn1-response')).toContainText(expected)

  // POST calls
  await expect(page.getByTestId('cons_serverPostFn1-response')).toContainText(
    expected,
  )
  await expect(page.getByTestId('cons_postFn1-response')).toContainText(
    expected,
  )
})

test('submitting multipart/form-data as server function input', async ({
  page,
}) => {
  await page.goto('/multipart')

  await page.waitForLoadState('networkidle')
  const expected =
    (await page
      .getByTestId('expected-multipart-server-fn-result')
      .textContent()) || ''
  expect(expected).not.toBe('')

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByTestId('multipart-form-file-input').click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'my_file.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('test data', 'utf-8'),
  })
  await page.getByText('Submit (onClick)').click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('multipart-form-response')).toContainText(
    expected,
  )
})

test('isomorphic functions can have different implementations on client and server', async ({
  page,
}) => {
  await page.goto('/isomorphic-fns')

  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-isomorphic-results-btn').click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('server-result')).toContainText('server')
  await expect(page.getByTestId('client-result')).toContainText('client')
  await expect(page.getByTestId('ssr-result')).toContainText('server')

  await expect(page.getByTestId('server-echo-result')).toContainText(
    'server received hello',
  )
  await expect(page.getByTestId('client-echo-result')).toContainText(
    'client received hello',
  )
})

test('env-only functions can only be called on the server or client respectively', async ({
  page,
}) => {
  await page.goto('/env-only')

  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-env-only-results-btn').click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('server-on-server')).toContainText(
    'server got: hello',
  )
  await expect(page.getByTestId('server-on-client')).toContainText(
    'serverEcho threw an error: createServerOnlyFn() functions can only be called on the server!',
  )

  await expect(page.getByTestId('client-on-server')).toContainText(
    'clientEcho threw an error: createClientOnlyFn() functions can only be called on the client!',
  )
  await expect(page.getByTestId('client-on-client')).toContainText(
    'client got: hello',
  )
})

test('Server function can return null for GET and POST calls', async ({
  page,
}) => {
  await page.goto('/return-null')

  await page.waitForLoadState('networkidle')
  await page.getByTestId('test-allow-server-fn-return-null-btn').click()
  await page.waitForLoadState('networkidle')

  // GET call
  await expect(
    page.getByTestId('allow_return_null_getFn-response'),
  ).toContainText(JSON.stringify(null))

  // POST call
  await expect(
    page.getByTestId('allow_return_null_postFn-response'),
  ).toContainText(JSON.stringify(null))
})

test('Server function can correctly send and receive FormData', async ({
  page,
}) => {
  await page.goto('/serialize-form-data')

  await page.waitForLoadState('networkidle')
  const expected =
    (await page
      .getByTestId('expected-serialize-formdata-server-fn-result')
      .textContent()) || ''
  expect(expected).not.toBe('')

  await page.getByTestId('test-serialize-formdata-fn-calls-btn').click()
  await page.waitForLoadState('networkidle')

  await expect(
    page.getByTestId('serialize-formdata-form-response'),
  ).toContainText(expected)
})

test('server function correctly passes context when using FormData', async ({
  page,
}) => {
  await page.goto('/formdata-context')

  await page.waitForLoadState('networkidle')

  const expectedContextValue =
    (await page.getByTestId('expected-formdata-context-value').textContent()) ||
    ''
  expect(expectedContextValue).toBe('context-from-middleware')

  // Test FormData function
  await page.getByTestId('test-formdata-context-btn').click()
  await page.waitForLoadState('networkidle')

  // Wait for the result to appear
  await page.waitForSelector('[data-testid="formdata-context-result"]')

  const resultText =
    (await page.getByTestId('formdata-context-result').textContent()) || ''
  expect(resultText).not.toBe('')

  const result = JSON.parse(resultText)

  // Verify context was passed correctly for FormData function
  expect(result.success).toBe(true)
  expect(result.hasContext).toBe(true)
  expect(result.name).toBe('TestUser')
  expect(result.testString).toBeDefined()
  expect(result.testString).toContain('context-from-middleware')

  // Test simple function (no parameters)
  await page.getByTestId('test-simple-context-btn').click()
  await page.waitForLoadState('networkidle')

  // Wait for the result to appear
  await page.waitForSelector('[data-testid="formdata-context-result"]')

  const simpleResultText =
    (await page.getByTestId('formdata-context-result').textContent()) || ''
  expect(simpleResultText).not.toBe('')

  const simpleResult = JSON.parse(simpleResultText)

  // Verify context was passed correctly for simple function
  expect(simpleResult.success).toBe(true)
  expect(simpleResult.hasContext).toBe(true)
  expect(simpleResult.testString).toBeDefined()
  expect(simpleResult.testString).toContain('context-from-middleware')
})

test('server function can correctly send and receive headers', async ({
  page,
}) => {
  await page.goto('/headers')

  await page.waitForLoadState('networkidle')
  let headers = JSON.parse(
    await page.getByTestId('initial-headers-result').innerText(),
  )
  expect(headers['host']).toBe(`localhost:${PORT}`)
  expect(headers['user-agent']).toContain('Mozilla/5.0')
  expect(headers['sec-fetch-mode']).toBe('navigate')

  await page.getByTestId('test-headers-btn').click()
  await page.waitForSelector('[data-testid="updated-headers-result"]')

  headers = JSON.parse(
    await page.getByTestId('updated-headers-result').innerText(),
  )

  expect(headers['host']).toBe(`localhost:${PORT}`)
  expect(headers['user-agent']).toContain('Mozilla/5.0')
  expect(headers['sec-fetch-mode']).toBe('cors')
  expect(headers['referer']).toBe(`http://localhost:${PORT}/headers`)
})

test('Direct POST submitting FormData to a Server function returns the correct message', async ({
  page,
}) => {
  await page.goto('/submit-post-formdata')

  await page.waitForLoadState('networkidle')

  const expected =
    (await page
      .getByTestId('expected-submit-post-formdata-server-fn-result')
      .textContent()) || ''
  expect(expected).not.toBe('')

  await page.getByTestId('test-submit-post-formdata-fn-calls-btn').click()
  await page.waitForLoadState('networkidle')

  const result = await page.innerText('body')
  expect(result).toBe(expected)
})

test('CSRF middleware rejects cross-site Server function requests', async ({
  page,
  request,
}) => {
  await page.goto('/submit-post-formdata')
  await page.waitForLoadState('networkidle')

  const actionUrl = await page
    .getByTestId('submit-post-formdata-form')
    .getAttribute('action')

  expect(actionUrl).toBeTruthy()

  const response = await request.post(actionUrl!, {
    headers: {
      'Sec-Fetch-Site': 'cross-site',
    },
    multipart: {
      name: 'Sean',
    },
  })

  expect(response.status()).toBe(403)
  await expect(response.text()).resolves.toBe('Forbidden')
})

test("server function's dead code is preserved if already there", async ({
  page,
}) => {
  await page.goto('/dead-code-preserve')

  await page.waitForLoadState('networkidle')
  await page.getByTestId('test-dead-code-fn-call-btn').click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('dead-code-fn-call-response')).toContainText(
    '1',
  )

  await fs.promises.rm('count-effect.txt')
})

test.describe('server function sets cookies', () => {
  async function runCookieTest(page: Page, expectedCookieValue: string) {
    for (let i = 1; i <= 4; i++) {
      const key = `cookie-${i}-${expectedCookieValue}`

      const actualValue = await page.getByTestId(key).textContent()
      expect(actualValue).toBe(expectedCookieValue)
    }
  }
  test('SSR', async ({ page }) => {
    const expectedCookieValue = `SSR-${Date.now()}`
    await page.goto(`/cookies/set?value=${expectedCookieValue}`)
    await runCookieTest(page, expectedCookieValue)
  })

  test('client side navigation', async ({ page }) => {
    const expectedCookieValue = `CLIENT-${Date.now()}`
    await page.goto(`/cookies?value=${expectedCookieValue}`)
    await page.getByTestId('link-to-set').click()
    await runCookieTest(page, expectedCookieValue)
  })
})
;['GET', 'POST'].forEach((method) => {
  test.describe(`aborting a server function call: method ${method}`, () => {
    test('without aborting', async ({ page }) => {
      await page.goto('/abort-signal/' + method)

      await page.waitForLoadState('networkidle')

      await page.getByTestId('run-without-abort-btn').click()
      await page.waitForLoadState('networkidle')
      await page.waitForSelector(
        '[data-testid="result"]:has-text("server function result")',
      )
      await page.waitForSelector(
        '[data-testid="errorMessage"]:has-text("$undefined")',
      )

      const result = (await page.getByTestId('result').textContent()) || ''
      expect(result).toBe('server function result')

      const errorMessage =
        (await page.getByTestId('errorMessage').textContent()) || ''
      expect(errorMessage).toBe('$undefined')
    })

    test('aborting', async ({ page }) => {
      await page.goto('/abort-signal/' + method)
      await page.waitForLoadState('networkidle')

      await page.getByTestId('run-with-abort-btn').click()
      await page.waitForLoadState('networkidle')
      await page.waitForSelector(
        '[data-testid="result"]:has-text("$undefined")',
      )
      await page.waitForSelector(
        '[data-testid="errorMessage"]:has-text("aborted")',
      )

      const result = (await page.getByTestId('result').textContent()) || ''
      expect(result).toBe('$undefined')

      const errorMessage =
        (await page.getByTestId('errorMessage').textContent()) || ''
      expect(errorMessage).toContain('abort')
    })
  })
})

test.describe('server functions with async validation', () => {
  test.use({
    whitelistErrors: [
      'Failed to load resource: the server responded with a status of 500',
    ],
  })

  test('with valid input', async ({ page }) => {
    await page.goto('/async-validation')

    await page.waitForLoadState('networkidle')

    await page.getByTestId('run-with-valid-btn').click()
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="result"]:has-text("valid")')
    await page.waitForSelector(
      '[data-testid="errorMessage"]:has-text("$undefined")',
    )

    const result = (await page.getByTestId('result').textContent()) || ''
    expect(result).toBe('valid')

    const errorMessage =
      (await page.getByTestId('errorMessage').textContent()) || ''
    expect(errorMessage).toBe('$undefined')
  })

  test('with invalid input', async ({ page }) => {
    await page.goto('/async-validation')

    await page.waitForLoadState('networkidle')

    await page.getByTestId('run-with-invalid-btn').click()
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="result"]:has-text("$undefined")')
    await page.waitForSelector(
      '[data-testid="errorMessage"]:has-text("invalid")',
    )

    const result = (await page.getByTestId('result').textContent()) || ''
    expect(result).toBe('$undefined')

    const errorMessage =
      (await page.getByTestId('errorMessage').textContent()) || ''
    expect(errorMessage).toContain('Invalid input')
  })
})

test('raw response', async ({ page }) => {
  await page.goto('/raw-response')

  await page.waitForLoadState('networkidle')

  const expectedValue = (await page.getByTestId('expected').textContent()) || ''
  expect(expectedValue).not.toBe('')

  await page.getByTestId('button').click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('response')).toContainText(expectedValue)
})
;[{ mode: 'js' }, { mode: 'no-js' }].forEach(({ mode }) => {
  test(`Server function can redirect when sending formdata: mode = ${mode}`, async ({
    page,
  }) => {
    await page.goto('/formdata-redirect?mode=' + mode)

    await page.waitForLoadState('networkidle')
    const expected =
      (await page
        .getByTestId('expected-submit-post-formdata-server-fn-result')
        .textContent()) || ''
    expect(expected).not.toBe('')

    await page.getByTestId('test-submit-post-formdata-fn-calls-btn').click()

    await page.waitForLoadState('networkidle')

    await expect(
      page.getByTestId('formdata-redirect-target-name'),
    ).toContainText(expected)

    expect(page.url().endsWith(`/formdata-redirect/target/${expected}`))
  })
})

test.describe('middleware', () => {
  test.describe('client middleware should have access to router context via the router instance', () => {
    async function runTest(page: Page) {
      await page.waitForLoadState('networkidle')

      const expected =
        (await page.getByTestId('expected-server-fn-result').textContent()) ||
        ''
      expect(expected).not.toBe('')

      await page.getByTestId('btn-serverFn').click()
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('serverFn-loader-result')).toContainText(
        expected,
      )
      await expect(page.getByTestId('serverFn-client-result')).toContainText(
        expected,
      )
    }

    test('direct visit', async ({ page }) => {
      await page.goto('/middleware/client-middleware-router')
      await runTest(page)
    })

    test('client navigation', async ({ page }) => {
      await page.goto('/middleware')
      await page.getByTestId('client-middleware-router-link').click()
      await runTest(page)
    })
  })

  test('server function in combination with request middleware', async ({
    page,
  }) => {
    await page.goto('/middleware/request-middleware')

    await page.waitForLoadState('networkidle')

    async function checkEqual(prefix: string) {
      const requestParam = await page
        .getByTestId(`${prefix}-data-request-param`)
        .textContent()
      expect(requestParam).not.toBe('')
      const requestFunc = await page
        .getByTestId(`${prefix}-data-request-func`)
        .textContent()
      expect(requestParam).toBe(requestFunc)
    }

    await checkEqual('loader')

    await page.getByTestId('client-call-button').click()
    await page.waitForLoadState('networkidle')

    await checkEqual('client')
  })
})

test('factory', async ({ page }) => {
  await page.goto('/factory')

  await expect(page.getByTestId('factory-route-component')).toBeInViewport()

  const buttons = await page
    .locator('[data-testid^="btn-fn-"]')
    .elementHandles()
  for (const button of buttons) {
    const testId = await button.getAttribute('data-testid')

    if (!testId) {
      throw new Error('Button is missing data-testid')
    }

    const suffix = testId.replace('btn-fn-', '')

    const expected =
      (await page.getByTestId(`expected-fn-result-${suffix}`).textContent()) ||
      ''
    expect(expected).not.toBe('')

    await button.click()

    await expect(page.getByTestId(`fn-result-${suffix}`)).toContainText(
      expected,
    )

    await expect(page.getByTestId(`fn-comparison-${suffix}`)).toContainText(
      'equal',
    )
  }
})

test('primitives', async ({ page }) => {
  await page.goto('/primitives')

  const testCases = await page
    .locator('[data-testid^="expected-"]')
    .elementHandles()
  expect(testCases.length).not.toBe(0)

  for (const testCase of testCases) {
    const testId = await testCase.getAttribute('data-testid')

    if (!testId) {
      throw new Error('testcase is missing data-testid')
    }

    const suffix = testId.replace('expected-', '')

    const expected =
      (await page.getByTestId(`expected-${suffix}`).textContent()) || ''
    expect(expected).not.toBe('')

    await expect(page.getByTestId(`result-${suffix}`)).toContainText(expected)
  }
})

test('redirect in server function on direct navigation', async ({ page }) => {
  // Test direct navigation to a route with a server function that redirects
  await page.goto('/redirect-test')

  // Should redirect to target page
  await expect(page.getByTestId('redirect-target')).toBeVisible()
  expect(page.url()).toContain('/redirect-test/target')
})

test('redirect in server function called in query during SSR', async ({
  page,
}) => {
  // Test direct navigation to a route with a server function that redirects
  // when called inside a query with ssr: true
  await page.goto('/redirect-test-ssr')

  // Should redirect to target page
  await expect(page.getByTestId('redirect-target-ssr')).toBeVisible()
  expect(page.url()).toContain('/redirect-test-ssr/target')
})

test('re-exported server function factory middleware executes correctly', async ({
  page,
}) => {
  // This test specifically verifies that when a server function factory is re-exported
  // using `export { foo } from './module'` syntax, the middleware still executes.
  // Previously, this syntax caused middleware to be silently skipped.
  await page.goto('/factory')

  await expect(page.getByTestId('factory-route-component')).toBeInViewport()

  // Click the button for the re-exported factory function
  await page.getByTestId('btn-fn-reexportedFactoryFn').click()

  // Wait for the result
  await expect(page.getByTestId('fn-result-reexportedFactoryFn')).toContainText(
    'reexport-middleware-executed',
  )

  // Verify the full context was returned (middleware executed)
  await expect(
    page.getByTestId('fn-comparison-reexportedFactoryFn'),
  ).toContainText('equal')
})

test('star re-exported server function factory middleware executes correctly', async ({
  page,
}) => {
  // This test specifically verifies that when a server function factory is re-exported
  // using `export * from './module'` syntax, the middleware still executes.
  // Previously, this syntax caused middleware to be silently skipped.
  await page.goto('/factory')

  await expect(page.getByTestId('factory-route-component')).toBeInViewport()

  // Click the button for the star re-exported factory function
  await page.getByTestId('btn-fn-starReexportedFactoryFn').click()

  // Wait for the result
  await expect(
    page.getByTestId('fn-result-starReexportedFactoryFn'),
  ).toContainText('star-reexport-middleware-executed')

  // Verify the full context was returned (middleware executed)
  await expect(
    page.getByTestId('fn-comparison-starReexportedFactoryFn'),
  ).toContainText('equal')
})

test('nested star re-exported server function factory middleware executes correctly', async ({
  page,
}) => {
  // This test specifically verifies that when a server function factory is re-exported
  // through a nested chain (A -> B -> C) using `export * from './module'` syntax,
  // the middleware still executes correctly.
  await page.goto('/factory')

  await expect(page.getByTestId('factory-route-component')).toBeInViewport()

  // Click the button for the nested re-exported factory function
  await page.getByTestId('btn-fn-nestedReexportedFactoryFn').click()

  // Wait for the result
  await expect(
    page.getByTestId('fn-result-nestedReexportedFactoryFn'),
  ).toContainText('nested-middleware-executed')

  // Verify the full context was returned (middleware executed)
  await expect(
    page.getByTestId('fn-comparison-nestedReexportedFactoryFn'),
  ).toContainText('equal')
})

test('server-only imports in middleware.server() are stripped from client build', async ({
  page,
}) => {
  // This test verifies that server-only imports (like getRequestHeaders from @tanstack/react-start/server)
  // inside createMiddleware().server() are properly stripped from the client build.
  // If the .server() part is not removed, the build would fail with node:async_hooks externalization errors.
  // The fact that this page loads at all proves the server code was stripped correctly.
  await page.goto('/middleware/server-import-middleware')

  await page.waitForLoadState('networkidle')

  // Click the button to call the server function with middleware
  await page.getByTestId('test-server-import-middleware-btn').click()

  // Wait for the result - should contain our custom test header value
  await expect(
    page.getByTestId('server-import-middleware-result'),
  ).toContainText('test-header-value')
})

test('middleware factories with server-only imports are stripped from client build', async ({
  page,
}) => {
  // This test verifies that middleware factories (functions returning createMiddleware().server())
  // with server-only imports are properly stripped from the client build.
  // If the .server() part inside the factory is not removed, the build would fail with
  // node:async_hooks externalization errors because getRequestHeaders uses node:async_hooks internally.
  // The fact that this page loads at all proves the server code was stripped correctly.
  await page.goto('/middleware/middleware-factory')

  await page.waitForLoadState('networkidle')

  // Click the button to call the server function with factory middlewares
  await page.getByTestId('test-middleware-factory-btn').click()

  // Wait for the result - should contain our custom header value from the factory middleware
  await expect(page.getByTestId('header-value')).toContainText(
    'factory-header-value',
  )

  // Also verify the prefixed headers were matched correctly
  await expect(page.getByTestId('matched-headers')).toContainText(
    'x-factory-one',
  )
  await expect(page.getByTestId('matched-headers')).toContainText(
    'x-factory-two',
  )
})

test('redirect via server function with middleware does not cause serialization error (issue #5372)', async ({
  page,
}) => {
  // This test verifies that throwing a redirect from a server function
  // that has middleware attached does not cause a SerovalUnsupportedTypeError.
  // Issue #5372: Middleware causes serialization error when throwing redirects via server function
  await page.goto('/middleware/redirect-with-middleware')

  await page.waitForLoadState('networkidle')

  // Verify we're on the source page
  await expect(page.getByTestId('middleware-redirect-source')).toBeVisible()

  // Click the button to trigger the redirect via server function with middleware
  await page.getByTestId('trigger-redirect-btn').click()

  // Should redirect to target page without serialization error
  await expect(page.getByTestId('middleware-redirect-target')).toBeVisible()
  expect(page.url()).toContain('/middleware/redirect-with-middleware/target')

  // Verify no error was shown (would indicate serialization failure)
  await expect(page.getByTestId('error-message')).not.toBeVisible()
})

test.describe('unhandled exception in middleware (issue #5266)', () => {
  // Whitelist expected browser console errors since this test verifies error handling.
  test.use({ whitelistErrors: ['500', 'Unhandled middleware exception'] })

  test('does not crash server and shows error component', async ({ page }) => {
    // This test verifies that when a middleware throws an unhandled exception,
    // the server does not crash and the error is properly caught and displayed.
    // Issue #5266: Server crashes when unhandled exception in server function or middleware
    await page.goto('/middleware/unhandled-exception')

    // The error should be caught and displayed via errorComponent
    await expect(page.getByTestId('unhandled-exception-error')).toBeVisible()

    // Verify the error message is shown
    await expect(page.getByTestId('error-message')).toBeVisible()

    // The route component should NOT render since error was thrown
    await expect(page.getByTestId('route-success')).not.toBeVisible()
  })
})

test('function middleware receives serverFnMeta in options', async ({
  page,
}) => {
  // This test verifies that:
  // 1. Client middleware receives serverFnMeta with just { id } - NOT name or filename
  // 2. Server middleware receives serverFnMeta with full { id, name, filename }
  // 3. Request middleware receives serverFnMeta with full { id, name, filename } for server function calls
  // 4. Request middleware receives serverFnMeta as undefined for page requests (not server function calls)
  // 5. Client middleware can send the function metadata to the server via sendContext
  await page.goto('/middleware/function-metadata')

  await page.waitForLoadState('networkidle')

  // First, verify that for page requests, serverFnMeta is undefined
  // This is captured by the route-level server middleware and passed via serverContext
  // The middleware sets '$undefined' string to prove we actually executed and passed data through
  const pageRequestServerFnMeta = await page
    .getByTestId('page-request-server-fn-meta')
    .textContent()
  expect(pageRequestServerFnMeta).toBe('$undefined')

  // Verify SSR data - server captured metadata should have full properties
  const loaderFunctionId = await page
    .getByTestId('loader-function-id')
    .textContent()
  const loaderFunctionName = await page
    .getByTestId('loader-function-name')
    .textContent()
  const loaderFilename = await page.getByTestId('loader-filename').textContent()
  const loaderClientCapturedId = await page
    .getByTestId('loader-client-captured-id')
    .textContent()
  const loaderClientCapturedName = await page
    .getByTestId('loader-client-captured-name')
    .textContent()
  const loaderClientCapturedFilename = await page
    .getByTestId('loader-client-captured-filename')
    .textContent()
  const loaderRequestCapturedId = await page
    .getByTestId('loader-request-captured-id')
    .textContent()
  const loaderRequestCapturedName = await page
    .getByTestId('loader-request-captured-name')
    .textContent()
  const loaderRequestCapturedFilename = await page
    .getByTestId('loader-request-captured-filename')
    .textContent()

  // id should be a non-empty string
  expect(loaderFunctionId).toBeTruthy()
  expect(loaderFunctionId!.length).toBeGreaterThan(0)

  // name should be the variable name of the server function
  expect(loaderFunctionName).toBeTruthy()
  expect(loaderFunctionName).toBe('getMetadataFn')

  // filename should be the exact route file path
  expect(loaderFilename).toBe('src/routes/middleware/function-metadata.tsx')

  // Client captured ID should match the server function id
  // (sent via client middleware's sendContext)
  expect(loaderClientCapturedId).toBe(loaderFunctionId)

  // Client middleware should NOT have access to name or filename
  // These should be "undefined" (the fallback value we display in the UI)
  expect(loaderClientCapturedName).toBe('undefined')
  expect(loaderClientCapturedFilename).toBe('undefined')

  // Request middleware should have full metadata (id, name, filename)
  // since it runs server-side during server function calls
  expect(loaderRequestCapturedId).toBe(loaderFunctionId)
  expect(loaderRequestCapturedName).toBe('getMetadataFn')
  expect(loaderRequestCapturedFilename).toBe(
    'src/routes/middleware/function-metadata.tsx',
  )

  // Now test client-side call
  await page.getByTestId('call-server-fn-btn').click()
  await page.waitForSelector('[data-testid="client-data"]')

  const clientFunctionId = await page
    .getByTestId('client-function-id')
    .textContent()
  const clientFunctionName = await page
    .getByTestId('client-function-name')
    .textContent()
  const clientFilename = await page.getByTestId('client-filename').textContent()
  const clientClientCapturedId = await page
    .getByTestId('client-client-captured-id')
    .textContent()
  const clientClientCapturedName = await page
    .getByTestId('client-client-captured-name')
    .textContent()
  const clientClientCapturedFilename = await page
    .getByTestId('client-client-captured-filename')
    .textContent()
  const clientRequestCapturedId = await page
    .getByTestId('client-request-captured-id')
    .textContent()
  const clientRequestCapturedName = await page
    .getByTestId('client-request-captured-name')
    .textContent()
  const clientRequestCapturedFilename = await page
    .getByTestId('client-request-captured-filename')
    .textContent()

  // Client call should get the same server metadata
  expect(clientFunctionId).toBe(loaderFunctionId)
  expect(clientFunctionName).toBe(loaderFunctionName)
  expect(clientFilename).toBe(loaderFilename)

  // Client captured ID from client middleware should also match
  expect(clientClientCapturedId).toBe(loaderFunctionId)

  // Client middleware should NOT have access to name or filename
  expect(clientClientCapturedName).toBe('undefined')
  expect(clientClientCapturedFilename).toBe('undefined')

  // Request middleware should have full metadata for client-side calls too
  expect(clientRequestCapturedId).toBe(loaderFunctionId)
  expect(clientRequestCapturedName).toBe('getMetadataFn')
  expect(clientRequestCapturedFilename).toBe(
    'src/routes/middleware/function-metadata.tsx',
  )
})

test('server function is called with correct method option', async ({
  page,
}) => {
  await page.goto('/function-method', { waitUntil: 'networkidle' })

  await expect(page.getByTestId('method-route-component')).toBeInViewport()

  const buttons = await page
    .locator('[data-testid^="btn-fn-"]')
    .elementHandles()
  for (const button of buttons) {
    const testId = await button.getAttribute('data-testid')

    if (!testId) {
      throw new Error('Button is missing data-testid')
    }

    const suffix = testId.replace('btn-fn-', '')

    const expected =
      (await page.getByTestId(`expected-fn-result-${suffix}`).textContent()) ||
      ''
    expect(expected).not.toBe('')

    await button.click()

    await expect(page.getByTestId(`fn-result-${suffix}`)).toContainText(
      expected,
    )

    await expect(page.getByTestId(`fn-comparison-${suffix}`)).toContainText(
      'equal',
    )
  }
})

test('server function receives serverFnMeta in options', async ({ page }) => {
  // This test verifies that:
  // 1. Server functions receive `serverFnMeta` with full { id, name, filename }
  // 2. No1 works even when the said server function is called from another server function

  await page.goto('/function-metadata', { waitUntil: 'networkidle' })

  await expect(page.getByTestId('metadata-route-component')).toBeInViewport()

  // Test for no1
  const loaderNormalGet = await page
    .getByTestId('loader-normal-get-function-metadata')
    .textContent()
  const loaderNormalPost = await page
    .getByTestId('loader-normal-post-function-metadata')
    .textContent()

  // stringified metadata should not be empty string
  expect(loaderNormalGet).toBeTruthy()
  // metadata should have `id`, `name`, and `filename` property, with all of them being a non-empty string
  const normalGetMetadata = JSON.parse(loaderNormalGet!)
  expect(normalGetMetadata).toHaveProperty('id')
  expect(normalGetMetadata).toHaveProperty('name')
  expect(normalGetMetadata).toHaveProperty('filename')
  expect(typeof normalGetMetadata.id).toBe('string')
  expect(normalGetMetadata.id.length).toBeGreaterThan(0)
  expect(typeof normalGetMetadata.name).toBe('string')
  expect(normalGetMetadata.name.length).toBeGreaterThan(0)
  expect(typeof normalGetMetadata.filename).toBe('string')
  expect(normalGetMetadata.filename.length).toBeGreaterThan(0)

  // stringified metadata should not be empty string
  expect(loaderNormalPost).toBeTruthy()
  // metadata should have `id`, `name`, and `filename` property, with all of them being a non-empty string
  const normalPostMetadata = JSON.parse(loaderNormalPost!)
  expect(normalPostMetadata).toHaveProperty('id')
  expect(normalPostMetadata).toHaveProperty('name')
  expect(normalPostMetadata).toHaveProperty('filename')
  expect(typeof normalPostMetadata.id).toBe('string')
  expect(normalPostMetadata.id.length).toBeGreaterThan(0)
  expect(typeof normalPostMetadata.name).toBe('string')
  expect(normalPostMetadata.name.length).toBeGreaterThan(0)
  expect(typeof normalPostMetadata.filename).toBe('string')
  expect(normalPostMetadata.filename.length).toBeGreaterThan(0)

  // Test for no2
  const loaderNestingGet = await page
    .getByTestId('loader-nesting-get-function-metadata')
    .textContent()
  const loaderNestingPost = await page
    .getByTestId('loader-nesting-post-function-metadata')
    .textContent()

  // metadata should have `id`, `name`, and `filename` property, with all of them being a non-empty string
  const nestingGetMetadata = JSON.parse(loaderNestingGet!)
  expect(nestingGetMetadata).toHaveProperty('meta.id')
  expect(nestingGetMetadata).toHaveProperty('meta.name')
  expect(nestingGetMetadata).toHaveProperty('meta.filename')
  expect(typeof nestingGetMetadata.meta.id).toBe('string')
  expect(nestingGetMetadata.meta.id.length).toBeGreaterThan(0)
  expect(typeof nestingGetMetadata.meta.name).toBe('string')
  expect(nestingGetMetadata.meta.name.length).toBeGreaterThan(0)
  expect(typeof nestingGetMetadata.meta.filename).toBe('string')
  expect(nestingGetMetadata.meta.filename.length).toBeGreaterThan(0)
  expect(nestingGetMetadata).toHaveProperty('inner.get.id')
  expect(nestingGetMetadata).toHaveProperty('inner.get.name')
  expect(nestingGetMetadata).toHaveProperty('inner.get.filename')
  expect(nestingGetMetadata.inner.get.id.length).toBeGreaterThan(0)
  expect(nestingGetMetadata.inner.get.name.length).toBeGreaterThan(0)
  expect(nestingGetMetadata.inner.get.filename.length).toBeGreaterThan(0)
  expect(nestingGetMetadata).toHaveProperty('inner.post.id')
  expect(nestingGetMetadata).toHaveProperty('inner.post.name')
  expect(nestingGetMetadata).toHaveProperty('inner.post.filename')
  expect(nestingGetMetadata.inner.post.id.length).toBeGreaterThan(0)
  expect(nestingGetMetadata.inner.post.name.length).toBeGreaterThan(0)
  expect(nestingGetMetadata.inner.post.filename.length).toBeGreaterThan(0)

  // metadata should have `id`, `name`, and `filename` property, with all of them being a non-empty string
  const nestingPostMetadata = JSON.parse(loaderNestingPost!)
  expect(nestingPostMetadata).toHaveProperty('meta.id')
  expect(nestingPostMetadata).toHaveProperty('meta.name')
  expect(nestingPostMetadata).toHaveProperty('meta.filename')
  expect(typeof nestingPostMetadata.meta.id).toBe('string')
  expect(nestingPostMetadata.meta.id.length).toBeGreaterThan(0)
  expect(typeof nestingPostMetadata.meta.name).toBe('string')
  expect(nestingPostMetadata.meta.name.length).toBeGreaterThan(0)
  expect(typeof nestingPostMetadata.meta.filename).toBe('string')
  expect(nestingPostMetadata.meta.filename.length).toBeGreaterThan(0)
  expect(nestingPostMetadata).toHaveProperty('inner.get.id')
  expect(nestingPostMetadata).toHaveProperty('inner.get.name')
  expect(nestingPostMetadata).toHaveProperty('inner.get.filename')
  expect(nestingPostMetadata.inner.get.id.length).toBeGreaterThan(0)
  expect(nestingPostMetadata.inner.get.name.length).toBeGreaterThan(0)
  expect(nestingPostMetadata.inner.get.filename.length).toBeGreaterThan(0)
  expect(nestingPostMetadata).toHaveProperty('inner.post.id')
  expect(nestingPostMetadata).toHaveProperty('inner.post.name')
  expect(nestingPostMetadata).toHaveProperty('inner.post.filename')
  expect(nestingPostMetadata.inner.post.id.length).toBeGreaterThan(0)
  expect(nestingPostMetadata.inner.post.name.length).toBeGreaterThan(0)
  expect(nestingPostMetadata.inner.post.filename.length).toBeGreaterThan(0)
})

test('middleware can catch errors thrown by server function handlers', async ({
  page,
}) => {
  await page.goto('/middleware/catch-handler-error')

  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('catch-handler-error-title')).toBeVisible()

  await page.getByTestId('trigger-error-btn').click()

  await expect(page.getByTestId('transformed-error')).toBeVisible()

  await expect(page.getByTestId('transformed-error')).toContainText(
    'Middleware caught and transformed',
  )

  await expect(page.getByTestId('transformed-error')).toContainText(
    'This error should be caught by middleware',
  )
})

test('server function with custom fetch implementation passed directly', async ({
  page,
}) => {
  await page.goto('/custom-fetch')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-direct-custom-fetch-btn').click()
  await page.waitForSelector(
    '[data-testid="direct-custom-fetch-result"]:not(:has-text("null"))',
  )

  const result = await page
    .getByTestId('direct-custom-fetch-result')
    .textContent()
  expect(result).toContain('x-custom-fetch-direct')
})

test('server function with custom fetch implementation via middleware', async ({
  page,
}) => {
  await page.goto('/custom-fetch')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-middleware-custom-fetch-btn').click()
  await page.waitForSelector(
    '[data-testid="middleware-custom-fetch-result"]:not(:has-text("null"))',
  )

  const result = await page
    .getByTestId('middleware-custom-fetch-result')
    .textContent()
  expect(result).toContain('x-custom-fetch-middleware')
})

test('server function with chained middleware - later middleware overrides earlier', async ({
  page,
}) => {
  await page.goto('/custom-fetch')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-chained-middleware-btn').click()
  await page.waitForSelector(
    '[data-testid="chained-middleware-result"]:not(:has-text("null"))',
  )

  const result = await page
    .getByTestId('chained-middleware-result')
    .textContent()
  // Second middleware should override first, so only x-middleware-second should be present
  expect(result).toContain('x-middleware-second')
  expect(result).not.toContain('x-middleware-first')
})

test('server function with direct fetch overrides middleware fetch', async ({
  page,
}) => {
  await page.goto('/custom-fetch')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-direct-override-btn').click()
  await page.waitForSelector(
    '[data-testid="direct-override-result"]:not(:has-text("null"))',
  )

  const result = await page.getByTestId('direct-override-result').textContent()
  // Direct fetch should override middleware, so x-direct-override should be present
  // and x-custom-fetch-middleware should NOT be present
  expect(result).toContain('x-direct-override')
  expect(result).not.toContain('x-custom-fetch-middleware')
})

test('server function without custom fetch uses global serverFnFetch from createStart', async ({
  page,
}) => {
  await page.goto('/custom-fetch')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-no-custom-fetch-btn').click()
  await page.waitForLoadState('networkidle')
  await page.waitForSelector(
    '[data-testid="no-custom-fetch-result"]:not(:has-text("null"))',
  )

  const result = await page.getByTestId('no-custom-fetch-result').textContent()
  // Global serverFnFetch header should be present
  expect(result).toContain('x-global-fetch')
  // No other custom headers should be present
  expect(result).not.toContain('x-custom-fetch-direct')
  expect(result).not.toContain('x-custom-fetch-middleware')
  expect(result).not.toContain('x-middleware-first')
  expect(result).not.toContain('x-middleware-second')
  expect(result).not.toContain('x-direct-override')
})

test('server function uses global serverFnFetch from createStart', async ({
  page,
}) => {
  await page.goto('/custom-fetch')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-global-fetch-btn').click()
  await page.waitForSelector(
    '[data-testid="global-fetch-result"]:not(:has-text("null"))',
  )

  const result = await page.getByTestId('global-fetch-result').textContent()
  // Global serverFnFetch header should be present
  expect(result).toContain('x-global-fetch')
})

test('middleware fetch overrides global serverFnFetch from createStart', async ({
  page,
}) => {
  await page.goto('/custom-fetch')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-middleware-overrides-global-btn').click()
  await page.waitForSelector(
    '[data-testid="middleware-overrides-global-result"]:not(:has-text("null"))',
  )

  const result = await page
    .getByTestId('middleware-overrides-global-result')
    .textContent()
  // Middleware fetch should override global, so x-custom-fetch-middleware should be present
  expect(result).toContain('x-custom-fetch-middleware')
  // Global fetch header should NOT be present (overridden by middleware)
  expect(result).not.toContain('x-global-fetch')
})

test('direct fetch overrides global serverFnFetch from createStart', async ({
  page,
}) => {
  await page.goto('/custom-fetch')
  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-direct-overrides-global-btn').click()
  await page.waitForSelector(
    '[data-testid="direct-overrides-global-result"]:not(:has-text("null"))',
  )

  const result = await page
    .getByTestId('direct-overrides-global-result')
    .textContent()
  // Direct fetch should override global, so x-direct-override-global should be present
  expect(result).toContain('x-direct-override-global')
  // Global fetch header should NOT be present (overridden by direct fetch)
  expect(result).not.toContain('x-global-fetch')
})

test.describe('server function returns 405 when method is not allowed', () => {
  // Whitelist the expected 405 error since this test verifies method mismatch handling
  test.use({ whitelistErrors: ['405'] })

  async function runMethodNotAllowedTest(
    page: Page,
    methodParam: string,
    allowedMethod: string,
  ) {
    await page.goto(`/method-not-allowed/${methodParam}`)
    await page.waitForLoadState('networkidle')

    for (const testMethod of ['GET', 'POST', 'PUT', 'OPTIONS']) {
      const lower = testMethod.toLowerCase()
      await page.getByTestId(`${lower}-button`).click()
      await page.waitForLoadState('networkidle')

      if (testMethod === allowedMethod) {
        await expect(page.getByTestId(`${lower}-fetch-result`)).toContainText(
          '[200,"Hello, World!"]',
        )
      } else {
        await expect(page.getByTestId(`${lower}-fetch-result`)).toContainText(
          `[405,"expected ${allowedMethod} method. Got ${testMethod}"]`,
        )
      }
    }
  }

  test('serverFn defined with GET method', async ({ page }) => {
    await runMethodNotAllowedTest(page, 'get', 'GET')
  })

  test('serverFn without explicit method', async ({ page }) => {
    await runMethodNotAllowedTest(page, 'undefined', 'GET')
  })

  test('serverFn defined with POST method', async ({ page }) => {
    await runMethodNotAllowedTest(page, 'post', 'POST')
  })
})
