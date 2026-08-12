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
