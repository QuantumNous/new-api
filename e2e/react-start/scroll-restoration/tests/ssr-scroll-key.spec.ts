import { expect, test } from '@playwright/test'

const storageKey = 'tsr-scroll-restoration-v1_3'

test('SSR scroll restoration uses a custom restoration key', async ({
  page,
}) => {
  const customKeyScrollY = 650
  const historyKeyScrollY = 80

  // Seed storage during document initialization so a hydrated previous page
  // cannot persist an empty in-memory scroll cache over these entries.
  await page.addInitScript(
    ({ customKeyScrollY, historyKeyScrollY, storageKey }) => {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          'ssr-scroll-key': {
            window: { scrollX: 0, scrollY: customKeyScrollY },
          },
          'history-key': {
            window: { scrollX: 0, scrollY: historyKeyScrollY },
          },
        }),
      )
      window.history.replaceState({ __TSR_key: 'history-key' }, '')
    },
    { customKeyScrollY, historyKeyScrollY, storageKey },
  )

  await page.route(/\/assets\/.*\.js$/, (route) => route.abort())

  await page.goto('/ssr-scroll-key', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'ssr-scroll-key' }),
  ).toBeVisible()
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBe(customKeyScrollY)
})

test('SSR restores a configured nested target without client JavaScript', async ({
  page,
}) => {
  const nestedScrollTop = 80

  await page.addInitScript(
    ({ nestedScrollTop, storageKey }) => {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          'ssr-scroll-key': {
            '[data-scroll-restoration-id="ssr-scroll-key-nested"]': {
              scrollX: 0,
              scrollY: nestedScrollTop,
            },
          },
        }),
      )
    },
    { nestedScrollTop, storageKey },
  )
  await page.route(/\/assets\/.*\.js$/, (route) => route.abort())

  await page.goto('/ssr-scroll-key', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'ssr-scroll-key' }),
  ).toBeVisible()
  await expect(page.getByTestId('ssr-scroll-key-hydrated')).toHaveCount(0)
  await expect
    .poll(async () =>
      page
        .getByTestId('ssr-scroll-key-nested')
        .evaluate((element) => element.scrollTop),
    )
    .toBe(nestedScrollTop)
})

test('hydration does not reset a configured nested target restored by SSR', async ({
  page,
}) => {
  const nestedScrollTop = 80

  await page.addInitScript(
    ({ nestedScrollTop, storageKey }) => {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          'ssr-scroll-key': {
            '[data-scroll-restoration-id="ssr-scroll-key-nested"]': {
              scrollX: 0,
              scrollY: nestedScrollTop,
            },
          },
        }),
      )
    },
    { nestedScrollTop, storageKey },
  )

  await page.goto('/ssr-scroll-key')
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByRole('heading', { name: 'ssr-scroll-key' }),
  ).toBeVisible()
  await expect(page.getByTestId('ssr-scroll-key-hydrated')).toBeAttached()
  await expect
    .poll(async () =>
      page
        .getByTestId('ssr-scroll-key-nested')
        .evaluate((element) => element.scrollTop),
    )
    .toBe(nestedScrollTop)
})
